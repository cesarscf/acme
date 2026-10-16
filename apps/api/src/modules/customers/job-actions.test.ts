import { expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistants, charges, db, quotes, visits, workRecords } from '@acme/db';
import { treaty } from '@elysia/eden';
import { and, eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { openJob } from '../jobs/service';
import { addDays, localDate, toInstant } from '../time/time';
import { createCustomer } from './service';

const api = treaty(app);
const timeZone = 'America/Sao_Paulo';
const today = () => localDate(new Date(), timeZone);
const at = (days: number, time: string) => toInstant(addDays(today(), days), time, timeZone);

async function joaosJob() {
  const { professional, headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling', 'quotes', 'billing'] }, { headers });
  // Every day from 08:00 to 18:00, so the free slots do not depend on the weekday the test runs.
  await db
    .update(assistants)
    .set({
      playbook: { hours: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '08:00', end: '18:00' }] },
    })
    .where(and(eq(assistants.professionalId, professional.id), eq(assistants.role, 'scheduling')));
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(professional.id, { name: 'João Pereira', phoneNumber });
  const jobId = await openJob(professional.id, joao.id, 'Ar da sala não gela');
  const thread = async () => (await api.customers({ id: joao.id }).thread.get({ headers })).data!;
  return { professionalId: professional.id, joao, jobId, thread };
}

type Job = Awaited<ReturnType<typeof joaosJob>>;

async function visit({ professionalId, joao, jobId }: Job, scheduledAt: Date, fields: object = {}) {
  const [row] = await db
    .insert(visits)
    .values({ professionalId, customerId: joao.id, jobId, scheduledAt, durationMinutes: 60, ...fields })
    .returning();
  return row!;
}

async function quote({ professionalId, joao, jobId }: Job, status: 'sent' | 'approved') {
  const [row] = await db
    .insert(quotes)
    // Sent an hour ago, so a Visit booked now comes after it whatever the database clock says.
    .values({
      professionalId,
      customerId: joao.id,
      jobId,
      totalCents: 145000,
      status,
      sentAt: new Date(Date.now() - 3_600_000),
    })
    .returning();
  return row!;
}

async function service({ professionalId, joao, jobId }: Job, visitId: string | null = null) {
  const [row] = await db
    .insert(workRecords)
    .values({
      professionalId,
      customerId: joao.id,
      jobId,
      visitId,
      title: 'Troca do compressor',
      amountCents: 145000,
      paymentMethod: 'pix',
    })
    .returning();
  return row!;
}

const keys = (actions: { key: string; done: boolean }[]) => actions.map(({ key, done }) => (done ? `${key} ✓` : key));

test('a Visit not told yet offers Contar como foi, Mandar orçamento, Pedir confirmação and Remarcar', async () => {
  const job = await joaosJob();
  const booked = await visit(job, at(1, '09:00'));

  const { actions } = await job.thread();

  expect(actions).toEqual([
    { key: 'record', label: 'Contar como foi', role: null, visitId: booked.id, done: false },
    { key: 'quote', label: 'Mandar orçamento', role: 'quotes', done: false },
    { key: 'confirm', label: 'Pedir confirmação', role: 'scheduling', done: false },
    { key: 'reschedule', label: 'Remarcar', role: 'scheduling', done: false },
  ]);
});

test('Pedir confirmação is checked once asked, and gone once the Customer confirms', async () => {
  const job = await joaosJob();
  const scheduledAt = at(1, '09:00');
  const booked = await visit(job, scheduledAt, { confirmationRequestedFor: scheduledAt });

  expect(keys((await job.thread()).actions)).toEqual(['record', 'quote', 'confirm ✓', 'reschedule']);
  await db.update(visits).set({ status: 'confirmed' }).where(eq(visits.id, booked.id));
  expect(keys((await job.thread()).actions)).toEqual(['record', 'quote', 'reschedule']);
});

test('a Quote sent offers Lembrar o João', async () => {
  const job = await joaosJob();
  await visit(job, at(-1, '09:00'));
  await service(job).then(({ id }) => db.update(workRecords).set({ amountCents: null }).where(eq(workRecords.id, id)));
  await quote(job, 'sent');

  expect((await job.thread()).actions).toEqual([
    { key: 'remind_quote', label: 'Lembrar o João', role: 'quotes', done: false },
  ]);
});

test('a Quote approved makes the Lia ask to book the execution in the first free slots, with Outro', async () => {
  const job = await joaosJob();
  await visit(job, at(-1, '09:00'), { createdAt: at(-2, '09:00') });
  await quote(job, 'approved');
  // Tomorrow at 08:00 is taken by another Customer's Visit.
  const { customer: marta } = await createCustomer(job.professionalId, {
    name: 'Marta Lima',
    phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
  });
  const martasJob = await openJob(job.professionalId, marta.id, 'Limpeza');
  await db.insert(visits).values({
    professionalId: job.professionalId,
    customerId: marta.id,
    jobId: martasJob,
    scheduledAt: at(1, '08:00'),
    durationMinutes: 60,
  });

  const { items, actions } = await job.thread();

  expect(actions).toEqual([]);
  expect(items.at(-1)).toMatchObject({
    type: 'question',
    text: 'Quer que eu marque a execução com o João? Estes horários estão livres:',
    assistant: { name: 'Lia' },
    role: 'scheduling',
    options: [
      { label: expect.stringMatching(/^\S{3}, \d\d\/\d\d, às 09:00$/), hint: 'O primeiro horário livre' },
      { label: expect.stringMatching(/^\S{3}, \d\d\/\d\d, às 10:00$/) },
      { label: 'Outro', hint: 'Escreva o dia e o horário', other: true },
    ],
  });
});

test('once the execution is booked the question is gone and the booked Visit can be told', async () => {
  const job = await joaosJob();
  await visit(job, at(-1, '09:00'), { createdAt: at(-2, '09:00') });
  await quote(job, 'approved');
  const execution = await visit(job, at(2, '08:00'));

  const { items, actions } = await job.thread();

  expect(items.some((item) => item.type === 'question')).toBe(false);
  expect(actions).toEqual([
    { key: 'record', label: 'Contar como foi', role: null, visitId: execution.id, done: false },
    { key: 'confirm', label: 'Pedir confirmação', role: 'scheduling', done: false },
    { key: 'reschedule', label: 'Remarcar', role: 'scheduling', done: false },
  ]);
});

test('a service registered offers Cobrar no Pix and Agendar o retorno; a Pix sent offers Reenviar o Pix', async () => {
  const job = await joaosJob();
  const record = await service(job);

  expect((await job.thread()).actions).toEqual([
    { key: 'charge', label: 'Cobrar no Pix', role: 'billing', done: false },
    { key: 'return_visit', label: 'Agendar o retorno', role: 'scheduling', done: false },
  ]);

  await db.insert(charges).values({
    professionalId: job.professionalId,
    workRecordId: record.id,
    customerId: job.joao.id,
    amountCents: 145000,
    paymentMethod: 'pix',
    sentAt: new Date(),
  });
  expect((await job.thread()).actions).toEqual([
    { key: 'resend_charge', label: 'Reenviar o Pix', role: 'billing', done: false },
  ]);
});

test('Agendar o retorno is checked once a Visit is booked after the service', async () => {
  const job = await joaosJob();
  await service(job);
  await visit(job, at(90, '09:00'));

  expect(keys((await job.thread()).actions)).toEqual(['charge', 'return_visit ✓']);
});
