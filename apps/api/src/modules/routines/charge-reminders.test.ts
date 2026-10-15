import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { assistantNotices, charges, customers, db, whatsappMessages, workRecords } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { and, eq, sql } from 'drizzle-orm';
import { TestClock } from 'pg-boss';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { ensureChargeTemplates } from '../charges/service';
import { findRoutine, startRoutines, stopRoutines } from './service';

const api = treaty(app);
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const schema = `pgboss_test_${randomInt(1e9)}`;
const clock = new TestClock('2030-06-01T12:00:00Z');

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureChargeTemplates();
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

async function approvedBillingAssistant() {
  const signedIn = await signInNewProfessional();
  await api.team.post({ roles: ['billing'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const billingAssistant = team![0]!;
  const briefing = api.team({ id: billingAssistant.id }).briefing;
  await briefing.answers.post({ step: 'paymentMethods', option: 'pix' }, { headers: signedIn.headers });
  await briefing.answers.post({ step: 'pixKey', text: 'carlos@example.com' }, { headers: signedIn.headers });
  await briefing.answers.post({ step: 'pixName', text: 'Carlos Souza' }, { headers: signedIn.headers });
  await briefing.answers.post({ step: 'pixCity', text: 'Campinas' }, { headers: signedIn.headers });
  expect((await briefing.approve.post(undefined, { headers: signedIn.headers })).status).toBe(200);
  return { ...signedIn, billingAssistant, briefing };
}

async function chargeSentAt(
  professionalId: string,
  sentAt: string,
  status: 'pending' | 'awaiting_confirmation' | 'paid' = 'pending',
) {
  const [customer] = await db
    .insert(customers)
    .values({
      professionalId,
      name: `Cliente ${randomUUID().slice(0, 4)}`,
      phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
    })
    .returning();
  const [workRecord] = await db
    .insert(workRecords)
    .values({ professionalId, customerId: customer!.id, title: 'Limpeza', amountCents: 35000, paymentMethod: 'pix' })
    .returning();
  const [charge] = await db
    .insert(charges)
    .values({
      professionalId,
      workRecordId: workRecord!.id,
      customerId: customer!.id,
      amountCents: 35000,
      paymentMethod: 'pix',
      status,
      sentAt: new Date(sentAt),
    })
    .returning();
  return { ...charge!, customer: customer! };
}

function messagesAbout(chargeId: string) {
  return db
    .select()
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.originType, 'charge'), eq(whatsappMessages.originId, chargeId)));
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

test('approving the billing Playbook creates the reminder Routine, and Desfazer removes it', async () => {
  const { billingAssistant, briefing, headers } = await approvedBillingAssistant();

  expect(await findRoutine(billingAssistant.id)).toMatchObject({ cron: '0 8-20 * * *', timezone: 'America/Sao_Paulo' });

  await briefing.undo.post(undefined, { headers });
  expect(await findRoutine(billingAssistant.id)).toBeNull();
});

test('the Routine reminds a pending Charge a day after it went out, at most twice, and never one awaiting confirmation or paid', async () => {
  await clock.setTime('2030-06-03T13:30:00Z');
  const { billingAssistant, professional } = await approvedBillingAssistant();
  const due = await chargeSentAt(professional.id, '2030-06-02T13:00:00Z');
  const recent = await chargeSentAt(professional.id, '2030-06-03T12:00:00Z');
  const awaiting = await chargeSentAt(professional.id, '2030-06-01T13:00:00Z', 'awaiting_confirmation');
  const paid = await chargeSentAt(professional.id, '2030-06-01T13:00:00Z', 'paid');

  await advanceTo('2030-06-03T14:00:30Z');
  await waitFor(async () => (await messagesAbout(due.id)).length === 1);
  // An hour later the last reminder is too recent to send another.
  await advanceTo('2030-06-03T15:00:30Z');
  await Bun.sleep(500);
  expect(await messagesAbout(due.id)).toHaveLength(1);

  await advanceTo('2030-06-04T15:00:30Z');
  await waitFor(async () => (await messagesAbout(due.id)).length === 2);
  await advanceTo('2030-06-05T16:00:30Z');
  await Bun.sleep(500);

  expect(await messagesAbout(due.id)).toEqual([
    expect.objectContaining({ direction: 'outbound', type: 'template', waId: due.customer.phoneNumber }),
    expect.objectContaining({ direction: 'outbound', type: 'template', waId: due.customer.phoneNumber }),
  ]);
  expect(await messagesAbout(recent.id)).toHaveLength(2);
  for (const other of [awaiting, paid]) expect(await messagesAbout(other.id)).toHaveLength(0);
  const notices = (await noticesOf(billingAssistant.id)).map(({ text }) => text);
  expect(notices.filter((text) => text.includes(`lembrei ${due.customer.name} do Pix`))).toHaveLength(2);
});

test('a reminder run that fails tries again and reminds no Customer twice', async () => {
  await clock.setTime('2030-06-10T13:30:00Z');
  const { professional } = await approvedBillingAssistant();
  const first = await chargeSentAt(professional.id, '2030-06-09T10:00:00Z');
  const second = await chargeSentAt(professional.id, '2030-06-09T11:00:00Z');
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
    await advanceTo('2030-06-10T14:00:30Z');
    await waitFor(async () => failed);
    await advanceTo('2030-06-10T14:10:00Z');
    await waitFor(async () => (await messagesAbout(second.id)).length > 0);
    await advanceTo('2030-06-10T15:00:30Z');
    await Bun.sleep(500);
  } finally {
    fetchSpy.mockRestore();
  }

  expect(await messagesAbout(first.id)).toHaveLength(1);
  expect(await messagesAbout(second.id)).toHaveLength(1);
});
