import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { assistantNotices, customers, db, quotes, whatsappMessages } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { and, eq, sql } from 'drizzle-orm';
import { TestClock } from 'pg-boss';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { ensureQuoteTemplates } from '../quotes/service';
import { findRoutine, startRoutines, stopRoutines } from './service';

const api = treaty(app);
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const schema = `pgboss_test_${randomInt(1e9)}`;
const clock = new TestClock('2030-05-01T12:00:00Z');

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureQuoteTemplates();
  await startRoutines({ schema, clock });
});

afterAll(async () => {
  await stopRoutines();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL client_min_messages TO warning`);
    await tx.execute(sql.raw(`DROP SCHEMA ${schema} CASCADE`));
  });
  await emulator.stop();
  await app.stop();
});

const olgaChips = { priceList: 'per_job', visitFee: 'free', quoteValidity: '15_days', followUp: 'remind' };

async function approvedOlga(followUp = 'remind') {
  const signedIn = await signInNewProfessional();
  await api.team.post({ roles: ['quotes'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const olga = team![0]!;
  const briefing = api.team({ id: olga.id }).briefing;
  const answer = async (step: string, option: string) =>
    expect((await briefing.answers.post({ step, option }, { headers: signedIn.headers })).status).toBe(200);
  for (const [step, option] of Object.entries({ ...olgaChips, followUp })) await answer(step, option);
  expect((await briefing.approve.post(undefined, { headers: signedIn.headers })).status).toBe(200);
  return { ...signedIn, olga, briefing, answer };
}

async function quoteSentAt(professionalId: string, sentAt: string, status: 'sent' | 'approved' | 'declined' = 'sent') {
  const [customer] = await db
    .insert(customers)
    .values({
      professionalId,
      name: `Cliente ${randomUUID().slice(0, 4)}`,
      phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
    })
    .returning();
  const [quote] = await db
    .insert(quotes)
    .values({
      professionalId,
      customerId: customer!.id,
      status,
      totalCents: 18000,
      sentAt: new Date(sentAt),
      validUntil: '2030-12-31',
    })
    .returning();
  return { ...quote!, customer: customer! };
}

function messagesAbout(quoteId: string) {
  return db
    .select()
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.originType, 'quote'), eq(whatsappMessages.originId, quoteId)));
}

function noticesOf(assistantId: string) {
  return db.select().from(assistantNotices).where(eq(assistantNotices.assistantId, assistantId));
}

async function waitFor(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await check()) return;
    await Bun.sleep(100);
  }
  throw new Error('timed out');
}

async function advanceTo(time: string) {
  await clock.setTime(new Date(time).getTime() - 60_000);
  await clock.tick(60_000);
}

test('approving Olga\'s Playbook creates the follow-up Routine, and "Não faça nada" or Desfazer removes it', async () => {
  const { olga, briefing, headers, answer } = await approvedOlga();

  expect(await findRoutine(olga.id)).toMatchObject({ cron: '0 8-20 * * *', timezone: 'America/Sao_Paulo' });

  await answer('followUp', 'nothing');
  expect(await findRoutine(olga.id)).toBeNull();

  await answer('followUp', 'remind');
  expect(await findRoutine(olga.id)).not.toBeNull();
  await briefing.undo.post(undefined, { headers });
  expect(await findRoutine(olga.id)).toBeNull();
});

test('the Routine reminds the Customer once, 2 days after the Quote went out, and not if the Customer answered', async () => {
  await clock.setTime('2030-05-03T13:30:00Z');
  const { olga, professional } = await approvedOlga();
  const due = await quoteSentAt(professional.id, '2030-05-01T13:00:00Z');
  const recent = await quoteSentAt(professional.id, '2030-05-02T13:00:00Z');
  const approved = await quoteSentAt(professional.id, '2030-05-01T13:00:00Z', 'approved');
  const declined = await quoteSentAt(professional.id, '2030-05-01T13:00:00Z', 'declined');

  await advanceTo('2030-05-03T14:00:30Z');
  await waitFor(async () => (await messagesAbout(due.id)).length > 0);
  await advanceTo('2030-05-03T15:00:30Z');
  await Bun.sleep(500);

  expect(await messagesAbout(due.id)).toEqual([
    expect.objectContaining({ direction: 'outbound', type: 'template', waId: due.customer.phoneNumber }),
  ]);
  for (const other of [recent, approved, declined]) expect(await messagesAbout(other.id)).toHaveLength(0);
  expect((await noticesOf(olga.id)).map(({ text }) => text)).toEqual([
    expect.stringContaining(`lembrei ${due.customer.name}`),
  ]);
});

test('the Routine sends nothing at night: a Quote due at 2h is reminded at 8h', async () => {
  await clock.setTime('2030-05-10T04:30:00Z');
  const { professional } = await approvedOlga();
  const due = await quoteSentAt(professional.id, '2030-05-08T05:00:00Z');

  // 3h in São Paulo.
  await advanceTo('2030-05-10T06:00:30Z');
  await Bun.sleep(500);
  expect(await messagesAbout(due.id)).toHaveLength(0);

  await advanceTo('2030-05-10T11:00:30Z');
  await waitFor(async () => (await messagesAbout(due.id)).length > 0);
});

test('with "Me avise e eu decido" the Routine tells the Professional and sends nothing to the Customer', async () => {
  await clock.setTime('2030-05-17T13:30:00Z');
  const { olga, professional } = await approvedOlga('notify_me');
  const due = await quoteSentAt(professional.id, '2030-05-15T13:00:00Z');

  await advanceTo('2030-05-17T14:00:30Z');
  await waitFor(async () => (await noticesOf(olga.id)).length > 0);

  expect(await messagesAbout(due.id)).toHaveLength(0);
  expect((await noticesOf(olga.id)).map(({ text }) => text)).toEqual([
    expect.stringContaining(`${due.customer.name} ainda não respondeu`),
  ]);
});

test('a follow-up run that fails tries again and reminds no Customer twice', async () => {
  await clock.setTime('2030-05-24T13:30:00Z');
  const { professional } = await approvedOlga();
  const first = await quoteSentAt(professional.id, '2030-05-22T10:00:00Z');
  const second = await quoteSentAt(professional.id, '2030-05-22T11:00:00Z');
  const realFetch = globalThis.fetch;
  let failed = false;
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input, init) => {
    if (!failed && String(init?.body).includes(second.customer.phoneNumber)) {
      failed = true;
      throw new Error('network down');
    }
    return realFetch(input, init);
  }) as typeof fetch);

  try {
    await advanceTo('2030-05-24T14:00:30Z');
    await waitFor(async () => failed);
    await advanceTo('2030-05-24T14:10:00Z');
    await waitFor(async () => (await messagesAbout(second.id)).length > 0);
    await advanceTo('2030-05-24T15:00:30Z');
    await Bun.sleep(500);
  } finally {
    fetchSpy.mockRestore();
  }

  expect(await messagesAbout(first.id)).toHaveLength(1);
  expect(await messagesAbout(second.id)).toHaveLength(1);
});
