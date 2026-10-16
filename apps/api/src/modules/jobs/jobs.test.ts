import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { db, jobs, quotes, visits, workRecords } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { confirmChargePaid, createCharge } from '../charges/service';
import { startFakeClaude } from '../conversations/fake-claude';
import { findAssistant } from '../conversations/service';
import { runTool } from '../conversations/test-tools';
import { createCustomer } from '../customers/service';
import { ensureQuoteTemplates, findQuote, sendQuote } from '../quotes/service';
import { quoteTools } from '../quotes/tools';
import { addDays, localDate } from '../time/time';
import { visitTools } from '../visits/tools';
import { listMessages } from '../whatsapp/service';

const api = treaty(app);
const claude = startFakeClaude();
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureQuoteTemplates();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
  await app.stop();
});

async function professionalWithTeam() {
  const signedIn = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
  await api.team.post({ roles: ['scheduling', 'quotes', 'billing'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const assistant = async (role: string) =>
    (await findAssistant(signedIn.professional.id, team!.find((member) => member.role === role)!.id))!;
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(signedIn.professional.id, { name: 'João Pereira', phoneNumber });
  return {
    ...signedIn,
    joao,
    schedulingAssistant: await assistant('scheduling'),
    quotesAssistant: await assistant('quotes'),
  };
}

type Team = Awaited<ReturnType<typeof professionalWithTeam>>;

function tomorrow(days = 1) {
  return addDays(localDate(new Date(), 'America/Sao_Paulo'), days);
}

function idIn(result: string) {
  return (JSON.parse(result.slice(result.indexOf('{'))) as { id: string }).id;
}

async function bookVisit({ schedulingAssistant, joao }: Team, title: string | null, time = '09:00', days = 1) {
  const { text, isError } = await runTool(visitTools(schedulingAssistant), 'createVisit', {
    customerId: joao.id,
    date: tomorrow(days),
    time,
    durationMinutes: null,
    allowConflict: false,
    title,
  });
  expect(isError).toBeFalsy();
  const [visit] = await db
    .select()
    .from(visits)
    .where(eq(visits.id, idIn(text)));
  return visit!;
}

async function makeQuote({ quotesAssistant, joao }: Team) {
  const { text, isError } = await runTool(quoteTools(quotesAssistant), 'createQuote', {
    customerId: joao.id,
    items: [{ priceItemId: null, description: 'Troca de compressor', quantity: 1, unitPriceCents: 180000 }],
  });
  expect(isError).toBeFalsy();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, idIn(text)));
  return quote!;
}

function jobsOf(customerId: string) {
  return db.select().from(jobs).where(eq(jobs.customerId, customerId));
}

function extracted(output: Record<string, unknown>) {
  const empty = {
    customer: null,
    newCustomer: null,
    visit: null,
    title: null,
    description: null,
    materials: null,
    amountCents: null,
    paymentMethod: null,
    cashReceived: null,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ...empty, ...output }) }] };
}

async function recordVisit({ headers }: Team, visitId: string, output: Record<string, unknown>) {
  claude.reply(extracted(output));
  const { data, error } = await api['work-records'].post({ transcript: 'Troquei o compressor.', visitId }, { headers });
  expect(error).toBeNull();
  const [workRecord] = await db.select().from(workRecords).where(eq(workRecords.id, data!.id));
  return workRecord!;
}

test('booking a Visit for a Customer without an open Job opens one titled after the request; a second Visit reuses it', async () => {
  const team = await professionalWithTeam();

  const first = await bookVisit(team, 'Ar da sala não gela');
  const second = await bookVisit(team, 'Outra coisa', '15:00');

  const found = await jobsOf(team.joao.id);
  expect(found).toEqual([
    expect.objectContaining({
      id: first.jobId,
      professionalId: team.professional.id,
      title: 'Ar da sala não gela',
      status: 'open',
      closedAt: null,
    }),
  ]);
  expect(second.jobId).toBe(first.jobId);
});

test('a Visit booked without a title opens a Job called Visita', async () => {
  const team = await professionalWithTeam();

  await bookVisit(team, null);

  expect(await jobsOf(team.joao.id)).toEqual([expect.objectContaining({ title: 'Visita', status: 'open' })]);
});

test('a Quote goes into the open Job; without one, it opens a Job titled after its first item', async () => {
  const withVisit = await professionalWithTeam();
  const visit = await bookVisit(withVisit, 'Ar da sala não gela');
  const alone = await professionalWithTeam();

  const inJob = await makeQuote(withVisit);
  const outside = await makeQuote(alone);

  expect(inJob.jobId).toBe(visit.jobId);
  expect(await jobsOf(alone.joao.id)).toEqual([
    expect.objectContaining({ id: outside.jobId, title: 'Troca de compressor', status: 'open' }),
  ]);
});

test("a WorkRecord of a Visit goes into the Visit's Job; one without a Visit goes into the open Job or opens one", async () => {
  const team = await professionalWithTeam();
  const visit = await bookVisit(team, 'Ar da sala não gela');
  const alone = await professionalWithTeam();

  const ofVisit = await recordVisit(team, visit.id, { title: 'Troca de compressor', amountCents: 180000 });
  claude.reply(extracted({ customer: 'C1', title: 'Limpeza de split', amountCents: 18000 }));
  const { data } = await api['work-records'].post(
    { transcript: 'Limpei o split do João, 180 no Pix.' },
    { headers: alone.headers },
  );

  expect(ofVisit.jobId).toBe(visit.jobId);
  const [created] = await db.select().from(workRecords).where(eq(workRecords.id, data!.id));
  expect(await jobsOf(alone.joao.id)).toEqual([
    expect.objectContaining({ id: created!.jobId, title: 'Limpeza de split', status: 'open' }),
  ]);
});

test('a WorkRecord whose Customer is chosen later goes into that Customer’s Job', async () => {
  const team = await professionalWithTeam();
  const visit = await bookVisit(team, 'Ar da sala não gela');
  claude.reply(extracted({ title: 'Troca de capacitor', amountCents: 35000 }));
  const { data } = await api['work-records'].post({ transcript: 'Troquei o capacitor.' }, { headers: team.headers });
  expect(data!.customer).toBeNull();

  await api['work-records']({ id: data!.id }).patch({ customerId: team.joao.id }, { headers: team.headers });

  const [workRecord] = await db.select().from(workRecords).where(eq(workRecords.id, data!.id));
  expect(workRecord!.jobId).toBe(visit.jobId);
});

test('a paid Pix Charge concludes the Job, and the next request opens a new one', async () => {
  const team = await professionalWithTeam();
  const visit = await bookVisit(team, 'Ar da sala não gela');
  const workRecord = await recordVisit(team, visit.id, { title: 'Troca de compressor', amountCents: 180000 });
  const created = await createCharge(team.professional.id, workRecord.id);

  await confirmChargePaid(team.professional.id, created.charge!.id, true);

  const [job] = await jobsOf(team.joao.id);
  expect(job).toMatchObject({ status: 'done', closedAt: expect.any(Date) });
  const next = await bookVisit(team, 'Limpeza de abril', '09:00', 3);
  expect(next.jobId).not.toBe(visit.jobId);
});

test('cash received concludes the Job', async () => {
  const team = await professionalWithTeam();
  const visit = await bookVisit(team, 'Ar da sala não gela');

  await recordVisit(team, visit.id, {
    title: 'Troca de compressor',
    amountCents: 180000,
    paymentMethod: 'cash',
    cashReceived: true,
  });

  expect(await jobsOf(team.joao.id)).toEqual([expect.objectContaining({ status: 'done' })]);
});

test('a declined Quote without a later Visit concludes the Job as declined; with one, the Job stays open', async () => {
  const declined = await professionalWithTeam();
  const stays = await professionalWithTeam();
  await bookVisit(stays, 'Ar da sala não gela', '10:00', 5);

  for (const team of [declined, stays]) {
    const quote = (await findQuote(team.professional.id, (await makeQuote(team)).id))!;
    await sendQuote(quote, { ...team.professional, timezone: 'America/Sao_Paulo' }, 15);
    const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: team.joao.phoneNumber });
    await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 1 });
  }

  expect(await jobsOf(declined.joao.id)).toEqual([
    expect.objectContaining({ status: 'declined', closedAt: expect.any(Date) }),
  ]);
  expect(await jobsOf(stays.joao.id)).toEqual([expect.objectContaining({ status: 'open' })]);
});
