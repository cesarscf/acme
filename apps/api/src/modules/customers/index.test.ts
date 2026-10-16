import { expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { charges, db, jobs, quoteItems, quotes, visits, workRecords } from '@acme/db';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { openJob } from '../jobs/service';
import { addDays, localDate, toInstant } from '../time/time';
import { createCustomer } from './service';

const api = treaty(app);
const timeZone = 'America/Sao_Paulo';
const today = () => localDate(new Date(), timeZone);
const at = (days: number, time: string) => toInstant(addDays(today(), days), time, timeZone);

async function newProfessional() {
  const { professional, headers } = await signInNewProfessional();
  const customer = async (name: string) =>
    (
      await createCustomer(professional.id, {
        name,
        phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
      })
    ).customer;
  return { professional, headers, customer };
}

type Customer = Awaited<ReturnType<Awaited<ReturnType<typeof newProfessional>>['customer']>>;

async function visitFor(customer: Customer, title: string, scheduledAt: Date, fields: object = {}) {
  const jobId = await openJob(customer.professionalId, customer.id, title);
  const [visit] = await db
    .insert(visits)
    .values({
      professionalId: customer.professionalId,
      customerId: customer.id,
      jobId,
      scheduledAt,
      durationMinutes: 60,
      createdAt: new Date(scheduledAt.getTime() - 86_400_000),
      ...fields,
    })
    .returning();
  return visit!;
}

async function quoteFor(customer: Customer, totalCents: number, fields: object = {}) {
  const jobId = await openJob(customer.professionalId, customer.id, 'Troca de compressor');
  const [quote] = await db
    .insert(quotes)
    .values({
      professionalId: customer.professionalId,
      customerId: customer.id,
      jobId,
      totalCents,
      status: 'sent',
      sentAt: new Date(),
      validUntil: '2099-12-31',
      ...fields,
    })
    .returning();
  await db.insert(quoteItems).values({
    quoteId: quote!.id,
    description: 'Troca de compressor',
    quantity: 1,
    unitPriceCents: totalCents,
    position: 0,
  });
  return quote!;
}

async function workRecordFor(customer: Customer, fields: Partial<typeof workRecords.$inferInsert> = {}) {
  const jobId = await openJob(customer.professionalId, customer.id, fields.title ?? 'Serviço');
  const [workRecord] = await db
    .insert(workRecords)
    .values({
      professionalId: customer.professionalId,
      customerId: customer.id,
      jobId,
      paymentMethod: 'pix',
      transcript: 'Troquei o capacitor.\nFicou 350 no Pix.',
      ...fields,
    })
    .returning();
  return workRecord!;
}

async function paidPix(workRecord: typeof workRecords.$inferSelect, paidAt = new Date()) {
  await db.insert(charges).values({
    professionalId: workRecord.professionalId,
    workRecordId: workRecord.id,
    customerId: workRecord.customerId!,
    amountCents: workRecord.amountCents!,
    paymentMethod: 'pix',
    status: 'paid',
    sentAt: paidAt,
    paidAt,
  });
  await db.update(jobs).set({ status: 'done', closedAt: paidAt }).where(eq(jobs.id, workRecord.jobId!));
}

test('the Customers list has Hoje by time, Esperando o cliente with what is missing, and Recentes', async () => {
  const { headers, customer } = await newProfessional();
  const late = await customer('Ana Souza');
  const early = await customer('Bruno Lima');
  const quoted = await customer('Carla Dias');
  const unpaid = await customer('Davi Rocha');
  const next = await customer('Eva Nunes');
  const done = await customer('Fábio Melo');
  await visitFor(late, 'Ar da sala não gela', at(0, '23:59'));
  await visitFor(early, 'Limpeza de split', at(0, '00:01'));
  await quoteFor(quoted, 180000);
  await workRecordFor(unpaid, { title: 'Troca de capacitor', amountCents: 35000 });
  await visitFor(next, 'Instalação de split', at(3, '14:00'));
  const old = await workRecordFor(done, { title: 'Limpeza de split', amountCents: 18000 });
  await paidPix(old, new Date(Date.now() - 20 * 86_400_000));

  const { data, status } = await api.customers.get({ query: {}, headers });

  expect(status).toBe(200);
  expect(data!.sections.map(({ key, title }) => [key, title])).toEqual([
    ['today', 'HOJE'],
    ['waiting', 'ESPERANDO O CLIENTE'],
    ['recent', 'RECENTES'],
  ]);
  const [todayRows, waitingRows, recentRows] = data!.sections.map(({ rows }) => rows);
  expect(todayRows).toMatchObject([
    { id: early.id, name: 'Bruno Lima', when: '00:01', detail: 'Limpeza de split · feita' },
    { id: late.id, name: 'Ana Souza', when: '23:59', detail: 'Ar da sala não gela' },
  ]);
  expect(waitingRows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: quoted.id,
        when: 'hoje',
        detail: expect.stringMatching(/^Orçamento de R\$\s1\.800 · enviado hoje$/),
        status: { label: 'Orçamento enviado', tone: 'sent' },
      }),
      expect.objectContaining({
        id: unpaid.id,
        detail: expect.stringMatching(/^Serviço de R\$\s350 · falta cobrar$/),
        status: { label: 'A cobrar', tone: 'wait' },
      }),
    ]),
  );
  expect(recentRows).toMatchObject([
    {
      id: next.id,
      detail: 'Próxima: instalação de split, 14:00',
      status: { label: 'Não enviado', tone: 'none' },
    },
    {
      id: done.id,
      detail: expect.stringMatching(/^Limpeza de split · R\$\s180$/),
      status: { label: 'Pago', tone: 'ok' },
    },
  ]);
  expect(recentRows![0]!.when).toMatch(/^\S{3}, \d{2} \S{3}$/);
});

test('a section without anyone is left out, and a Customer with nothing yet is Recente', async () => {
  const { headers, customer } = await newProfessional();
  const ana = await customer('Ana Souza');

  const { data } = await api.customers.get({ query: {}, headers });

  expect(data!.sections).toEqual([
    {
      key: 'recent',
      title: 'RECENTES',
      rows: [expect.objectContaining({ id: ana.id, status: null })],
      confirmation: null,
    },
  ]);
});

test('the search ignores accents and cedillas, and finds nobody without a match', async () => {
  const { headers, customer } = await newProfessional();
  const joao = await customer('João Pereira');
  const conceicao = await customer('Maria Conceição');
  await customer('Pedro Alves');

  const names = async (query: string) =>
    (await api.customers.get({ query: { query }, headers })).data!.sections.flatMap(({ rows }) =>
      rows.map(({ id }) => id),
    );

  expect(await names('Joao')).toEqual([joao.id]);
  expect(await names('Conceicao')).toEqual([conceicao.id]);
  expect(await names('Zé')).toEqual([]);
});

test('the thread pins the open Job with its steps and shows earlier Jobs as compact cards', async () => {
  const { headers, customer } = await newProfessional();
  const joao = await customer('João Pereira');
  const old = await workRecordFor(joao, { title: 'Limpeza de split', amountCents: 18000, createdAt: at(-60, '10:00') });
  await paidPix(old, at(-60, '12:00'));
  const visit = await visitFor(joao, 'Ar da sala não gela', at(-1, '08:00'));
  await workRecordFor(joao, {
    visitId: visit.id,
    title: 'Visita técnica',
    description: 'Compressor queimado',
    createdAt: at(-1, '10:00'),
  });
  await quoteFor(joao, 180000);

  const { data, status } = await api.customers({ id: joao.id }).thread.get({ headers });

  expect(status).toBe(200);
  expect(data!.customer).toMatchObject({ id: joao.id, name: 'João Pereira' });
  expect(data!.pinned).toEqual({
    label: 'EM ANDAMENTO',
    title: 'Ar da sala não gela',
    status: { label: 'Orçamento enviado', tone: 'sent' },
    steps: [
      { label: 'Visita', state: 'done' },
      { label: 'Orçamento', state: 'current' },
      { label: 'Serviço', state: 'todo' },
      { label: 'Pagamento', state: 'todo' },
    ],
  });
  expect(data!.items.map(({ type }) => type)).toEqual([
    'past_job',
    'job_start',
    'day',
    'visit',
    'day',
    'work_record',
    'day',
    'quote',
  ]);
  expect(data!.items).toMatchObject([
    {
      type: 'past_job',
      title: 'Limpeza de split',
      detail: expect.stringMatching(/^R\$\s180,00 · Pix$/),
      status: { label: 'Pago', tone: 'ok' },
    },
    { type: 'job_start', title: 'Ar da sala não gela' },
    { type: 'day' },
    { type: 'visit', title: expect.stringMatching(/^Ar da sala não gela · \S{3}, \d{2} \S{3}, 08:00$/) },
    { type: 'day', label: 'Ontem' },
    {
      type: 'work_record',
      label: 'Visita registrada',
      rows: [
        { label: 'Cliente', value: 'João Pereira' },
        { label: 'O que viu', value: 'Compressor queimado' },
      ],
      transcript: ['Troquei o capacitor.', 'Ficou 350 no Pix.'],
    },
    { type: 'day', label: 'Hoje' },
    {
      type: 'quote',
      total: expect.stringMatching(/^R\$\s1\.800,00$/),
      detail: 'Orçamento para João Pereira · enviado no WhatsApp',
      status: { label: 'Aguardando resposta', tone: 'wait' },
    },
  ]);
});

test('a service done without a Quote skips the Orçamento step, and paying it shows CONCLUÍDO', async () => {
  const { headers, customer } = await newProfessional();
  const joao = await customer('João Pereira');
  const visit = await visitFor(joao, 'Limpeza de split', at(-1, '08:00'));
  const workRecord = await workRecordFor(joao, { visitId: visit.id, title: 'Limpeza de split', amountCents: 18000 });
  const thread = async () => (await api.customers({ id: joao.id }).thread.get({ headers })).data!;

  const unpaid = await thread();
  await paidPix(workRecord);
  const paid = await thread();

  expect(unpaid.pinned).toMatchObject({
    label: 'EM ANDAMENTO',
    status: { label: 'A cobrar', tone: 'wait' },
    steps: [
      { label: 'Visita', state: 'done' },
      { label: 'Orçamento', state: 'skipped' },
      { label: 'Serviço', state: 'done' },
      { label: 'Pagamento', state: 'current' },
    ],
  });
  expect(unpaid.items).toContainEqual(expect.objectContaining({ type: 'work_record', label: 'Serviço registrado' }));
  expect(paid.pinned).toMatchObject({
    label: 'CONCLUÍDO',
    status: { label: 'Pago', tone: 'ok' },
    steps: [
      { label: 'Visita', state: 'done' },
      { label: 'Orçamento', state: 'skipped' },
      { label: 'Serviço', state: 'done' },
      { label: 'Pagamento', state: 'done' },
    ],
  });
  expect(paid.items).toContainEqual(
    expect.objectContaining({
      type: 'pix',
      status: { label: expect.stringMatching(/^Pago às \d{2}:\d{2}$/), tone: 'ok' },
    }),
  );
});

test('a Visit still to happen has the Orçamento step optional', async () => {
  const { headers, customer } = await newProfessional();
  const joao = await customer('João Pereira');
  await visitFor(joao, 'Ar da sala não gela', at(2, '08:00'));

  const { data } = await api.customers({ id: joao.id }).thread.get({ headers });

  expect(data!.pinned!.steps).toEqual([
    { label: 'Visita', state: 'current' },
    { label: 'Orçamento', state: 'optional' },
    { label: 'Serviço', state: 'todo' },
    { label: 'Pagamento', state: 'todo' },
  ]);
});

test('a Customer without an open Job has nothing pinned; another Professional’s Customer is not found', async () => {
  const { headers, customer } = await newProfessional();
  const joao = await customer('João Pereira');
  const old = await workRecordFor(joao, { title: 'Limpeza de split', amountCents: 18000 });
  await paidPix(old, at(-30, '12:00'));
  const someoneElse = await newProfessional();

  const { data } = await api.customers({ id: joao.id }).thread.get({ headers });
  const foreign = await api.customers({ id: joao.id }).thread.get({ headers: someoneElse.headers });

  expect(data!.pinned).toBeNull();
  expect(data!.items.map(({ type }) => type)).toEqual(['past_job']);
  expect(foreign.status).toBe(404);
});
