import { afterAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { db, quotes, visits, workRecords } from '@acme/db';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { createCustomer } from '../customers/service';
import { openJob } from '../jobs/service';
import { addDays, localDate, toInstant } from '../time/time';

const api = treaty(app);
const claude = startFakeClaude();
const timeZone = 'America/Sao_Paulo';
const at = (days: number, time: string) => toInstant(addDays(localDate(new Date(), timeZone), days), time, timeZone);

afterAll(() => claude.stop());

async function professionalWithDay() {
  const { professional, headers } = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers });
  await api.team.post({ roles: ['scheduling', 'billing'] }, { headers });
  const customer = async (name: string) =>
    (
      await createCustomer(professional.id, {
        name,
        phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
      })
    ).customer;
  const visit = async (customerId: string, title: string, scheduledAt: Date) => {
    const jobId = await openJob(professional.id, customerId, title);
    const [row] = await db
      .insert(visits)
      .values({ professionalId: professional.id, customerId, jobId, scheduledAt, durationMinutes: 60 })
      .returning();
    return row!;
  };
  return { professionalId: professional.id, headers, customer, visit };
}

// The reference the prompt gave to a Visit line, e.g. "V2" for "- V2: Marta Lima, …".
function refOf(request: Anthropic.Beta.MessageCreateParams, name: string) {
  return new RegExp(`- (V\\d+): ${name}`).exec(request.messages[0]!.content as string)![1]!;
}

function picks(visit: string | null) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ visit }) }] };
}

test("Claude suggests today's Visit that fits what was said, even before it ends, and the others are options", async () => {
  const { headers, customer, visit } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const marta = await customer('Marta Lima');
  const joaosVisit = await visit(joao.id, 'Ar da sala não gela', at(0, '08:00'));
  const martasVisit = await visit(marta.id, 'Limpeza de split', at(0, '23:00'));
  claude.reply((request) => picks(refOf(request, 'João Pereira')));

  const { data, status } = await api['work-records'].match.post(
    { transcript: 'Fui no João, o compressor queimou.' },
    { headers },
  );

  expect(status).toBe(200);
  expect(claude.requests.at(-1)!.messages[0]!.content).toContain('<relato>Fui no João, o compressor queimou.</relato>');
  expect(data).toEqual({
    suggested: {
      visitId: joaosVisit.id,
      customerName: 'João Pereira',
      question: 'Pelo que você contou, é do João Pereira?',
      detail: 'Vai para a visita de hoje, 08:00 · Ar da sala não gela',
    },
    others: [{ visitId: martasVisit.id, customerName: 'Marta Lima', detail: 'Limpeza de split · hoje, 23:00' }],
    customers: expect.arrayContaining([{ id: joao.id, name: 'João Pereira' }]),
  });
  // Nothing is saved before the choice.
  expect(await db.select().from(workRecords).where(eq(workRecords.visitId, joaosVisit.id))).toEqual([]);
});

test('the next Visit of a Job with an approved Quote can be told; Visits already told or of other days cannot', async () => {
  const { professionalId, headers, customer, visit } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const marta = await customer('Marta Lima');
  const ana = await customer('Ana Souza');
  const diagnosis = await visit(joao.id, 'Ar da sala não gela', at(-2, '08:00'));
  await db.insert(quotes).values({
    professionalId,
    customerId: joao.id,
    jobId: diagnosis.jobId,
    totalCents: 145000,
    status: 'approved',
    sentAt: at(-2, '12:00'),
  });
  const [execution] = await db
    .insert(visits)
    .values({
      professionalId,
      customerId: joao.id,
      jobId: diagnosis.jobId,
      scheduledAt: at(3, '08:00'),
      durationMinutes: 60,
    })
    .returning();
  const told = await visit(marta.id, 'Limpeza', at(0, '08:00'));
  await db.insert(workRecords).values({
    professionalId,
    customerId: marta.id,
    jobId: told.jobId,
    visitId: told.id,
    paymentMethod: 'pix',
  });
  await visit(ana.id, 'Instalação', at(5, '08:00'));
  claude.reply((request) => {
    expect(request.messages[0]!.content).not.toContain('Marta Lima');
    expect(request.messages[0]!.content).not.toContain('Ana Souza');
    return picks(refOf(request, 'João Pereira'));
  });

  const { data } = await api['work-records'].match.post({ transcript: 'Troquei o compressor do João.' }, { headers });

  expect(data!.suggested).toMatchObject({ visitId: execution!.id });
  expect(data!.others).toEqual([]);
});

test('from a Visit (the Lia asking, or "Contar como foi") that Visit is suggested without asking Claude', async () => {
  const { headers, customer, visit } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const joaosVisit = await visit(joao.id, 'Ar da sala não gela', at(0, '08:00'));
  const requests = claude.requests.length;

  const { data } = await api['work-records'].match.post(
    { transcript: 'O compressor queimou.', visitId: joaosVisit.id },
    { headers },
  );

  expect(claude.requests.length).toBe(requests);
  expect(data!.suggested).toMatchObject({
    visitId: joaosVisit.id,
    question: 'Pelo que você contou, é do João Pereira?',
  });
});

test('without a Visit to tell, or when Claude finds none, nothing is suggested', async () => {
  const { headers, customer, visit } = await professionalWithDay();
  const requests = claude.requests.length;

  const { data: empty } = await api['work-records'].match.post({ transcript: 'Limpei um split.' }, { headers });

  expect(empty).toEqual({ suggested: null, others: [], customers: [] });
  expect(claude.requests.length).toBe(requests);

  const joao = await customer('João Pereira');
  const joaosVisit = await visit(joao.id, 'Ar da sala não gela', at(0, '08:00'));
  claude.reply(picks(null));
  const { data } = await api['work-records'].match.post({ transcript: 'Limpei o split da Ana.' }, { headers });
  expect(data).toEqual({
    suggested: null,
    others: [{ visitId: joaosVisit.id, customerName: 'João Pereira', detail: 'Ar da sala não gela · hoje, 08:00' }],
    customers: [{ id: joao.id, name: 'João Pereira' }],
  });
});

test("another Professional's Visit is not found, and matching needs the AI consent", async () => {
  const { customer, visit } = await professionalWithDay();
  const joao = await customer('João Pereira');
  const joaosVisit = await visit(joao.id, 'Ar da sala não gela', at(0, '08:00'));
  const other = await signInNewProfessional();

  const { status } = await api['work-records'].match.post(
    { transcript: 'O compressor queimou.', visitId: joaosVisit.id },
    { headers: other.headers },
  );

  expect(status).toBe(403);
  await api.me['ai-consent'].post(undefined, { headers: other.headers });
  const consented = await api['work-records'].match.post(
    { transcript: 'O compressor queimou.', visitId: joaosVisit.id },
    { headers: other.headers },
  );
  expect(consented.status).toBe(404);
});
