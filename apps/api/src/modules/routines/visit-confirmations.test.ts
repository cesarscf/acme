import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { assistantNotices, customers, db, professionals, visits, whatsappMessages } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { and, eq, sql } from 'drizzle-orm';
import { TestClock } from 'pg-boss';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { openJob } from '../jobs/service';
import { ensureVisitConfirmationTemplate, requestDueVisitConfirmations } from '../visits/service';
import { toInstant } from '../visits/time';
import { findRoutine, startRoutines, stopRoutines } from './service';

const api = treaty(app);
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const timeZone = 'America/Manaus';
const schema = `pgboss_test_${randomInt(1e9)}`;
const clock = new TestClock('2030-03-01T12:00:00Z');

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureVisitConfirmationTemplate();
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

const schedulingChips = { agenda: 'paper', hours: 'weekdays', booking: 'ask_first', confirmations: 'day_before' };

async function professionalWithSchedulingAssistant() {
  const signedIn = await signInNewProfessional();
  await db.update(professionals).set({ timezone: timeZone }).where(eq(professionals.id, signedIn.professional.id));
  await api.team.post({ roles: ['scheduling'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const schedulingAssistant = team![0]!;
  const briefing = api.team({ id: schedulingAssistant.id }).briefing;
  const answer = async (step: string, option: string) =>
    expect((await briefing.answers.post({ step, option }, { headers: signedIn.headers })).status).toBe(200);
  for (const [step, option] of Object.entries(schedulingChips)) await answer(step, option);
  return { ...signedIn, schedulingAssistant, briefing, answer };
}

async function approvedSchedulingAssistant() {
  const professional = await professionalWithSchedulingAssistant();
  expect((await professional.briefing.approve.post(undefined, { headers: professional.headers })).status).toBe(200);
  return professional;
}

async function visitAt(
  professionalId: string,
  date: string,
  time: string,
  status: 'scheduled' | 'confirmed' | 'cancelled' = 'scheduled',
) {
  const [customer] = await db
    .insert(customers)
    .values({
      professionalId,
      name: `Cliente ${randomUUID().slice(0, 4)}`,
      phoneNumber: `55929${String(randomInt(1e8)).padStart(8, '0')}`,
    })
    .returning();
  const [visit] = await db
    .insert(visits)
    .values({
      professionalId,
      customerId: customer!.id,
      jobId: await openJob(professionalId, customer!.id, 'Visita'),
      scheduledAt: toInstant(date, time, timeZone),
      durationMinutes: 60,
      status,
    })
    .returning();
  return { ...visit!, customer: customer! };
}

function confirmationsSentTo(visitId: string) {
  return db
    .select()
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.originType, 'visit'), eq(whatsappMessages.originId, visitId)));
}

// The worker runs on its own after a tick, so its effects are awaited in real time.
async function waitFor(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await check()) return;
    await Bun.sleep(100);
  }
  throw new Error('timed out');
}

// Jumps most of the way, as ticking fires every poll in between, then ticks so the cron pass and the worker run.
async function advanceTo(time: string) {
  await clock.setTime(new Date(time).getTime() - 60_000);
  await clock.tick(60_000);
}

test("approving the scheduling Playbook creates the Routine in the Professional's time zone, and Desfazer removes it", async () => {
  const { schedulingAssistant, briefing, headers } = await approvedSchedulingAssistant();

  expect(await findRoutine(schedulingAssistant.id)).toMatchObject({ cron: '0 18 * * *', timezone: timeZone });

  expect((await briefing.undo.post(undefined, { headers })).status).toBe(200);

  expect(await findRoutine(schedulingAssistant.id)).toBeNull();
  expect((await briefing.get({ headers })).data!.status).toBe('draft');
});

test('changing when the scheduling Assistant confirms in Ver ficha moves the Routine, and "Só quando você pedir" removes it', async () => {
  const { schedulingAssistant, answer } = await approvedSchedulingAssistant();

  await answer('confirmations', 'same_day');
  expect(await findRoutine(schedulingAssistant.id)).toMatchObject({ cron: '0 7 * * *', timezone: timeZone });

  await answer('confirmations', 'on_request');
  expect(await findRoutine(schedulingAssistant.id)).toBeNull();
});

test('a draft Playbook has no Routine and nothing to undo', async () => {
  const { schedulingAssistant, briefing, headers } = await professionalWithSchedulingAssistant();

  expect(await findRoutine(schedulingAssistant.id)).toBeNull();
  expect((await briefing.undo.post(undefined, { headers })).status).toBe(409);
});

test("the Routine asks for confirmation of tomorrow's Visits at 18h in the Professional's time zone", async () => {
  await clock.setTime('2030-03-12T20:30:00Z');
  const { schedulingAssistant, professional } = await approvedSchedulingAssistant();
  const tomorrow = await visitAt(professional.id, '2030-03-13', '14:00');
  const confirmed = await visitAt(professional.id, '2030-03-13', '09:00', 'confirmed');
  const cancelled = await visitAt(professional.id, '2030-03-13', '10:00', 'cancelled');
  const later = await visitAt(professional.id, '2030-03-14', '14:00');
  const today = await visitAt(professional.id, '2030-03-12', '19:00');

  // 18h in São Paulo is still 17h in Manaus.
  await advanceTo('2030-03-12T21:59:00Z');
  await Bun.sleep(500);
  expect(await confirmationsSentTo(tomorrow.id)).toHaveLength(0);

  await advanceTo('2030-03-12T22:01:00Z');
  await waitFor(async () => (await confirmationsSentTo(tomorrow.id)).length > 0);

  expect(await confirmationsSentTo(tomorrow.id)).toEqual([
    expect.objectContaining({ direction: 'outbound', waId: tomorrow.customer.phoneNumber }),
  ]);
  for (const other of [confirmed, cancelled, later, today]) expect(await confirmationsSentTo(other.id)).toHaveLength(0);
  const notices = await db
    .select()
    .from(assistantNotices)
    .where(eq(assistantNotices.assistantId, schedulingAssistant.id));
  expect(notices.map(({ text }) => text)).toEqual([expect.stringContaining(tomorrow.customer.name)]);
});

test('a Routine that fails tries again and asks no Customer twice', async () => {
  await clock.setTime('2030-03-19T21:30:00Z');
  const { professional } = await approvedSchedulingAssistant();
  const first = await visitAt(professional.id, '2030-03-20', '08:00');
  const second = await visitAt(professional.id, '2030-03-20', '10:00');
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
    await advanceTo('2030-03-19T22:01:00Z');
    await waitFor(async () => failed);
    await advanceTo('2030-03-19T22:10:00Z');
    await waitFor(async () => (await confirmationsSentTo(second.id)).length > 0);
  } finally {
    fetchSpy.mockRestore();
  }

  expect(await confirmationsSentTo(first.id)).toHaveLength(1);
  expect(await confirmationsSentTo(second.id)).toHaveLength(1);
});

test('two runs overlapping ask each Customer only once', async () => {
  const { professional } = await approvedSchedulingAssistant();
  const visit = await visitAt(professional.id, '2031-04-10', '10:00');
  const run = () => requestDueVisitConfirmations({ ...professional, timezone: timeZone }, '2031-04-10');

  await Promise.all([run(), run()]);

  expect(await confirmationsSentTo(visit.id)).toHaveLength(1);
});

test('a run missed while the API was down goes out once it is back, for the Visits it was due for', async () => {
  await clock.setTime('2030-03-26T21:30:00Z');
  const { professional } = await approvedSchedulingAssistant();
  const due = await visitAt(professional.id, '2030-03-27', '10:00');
  const dayAfter = await visitAt(professional.id, '2030-03-28', '10:00');

  // Back at 2h in Manaus, after midnight.
  await advanceTo('2030-03-27T06:00:00Z');
  await waitFor(async () => (await confirmationsSentTo(due.id)).length > 0);

  expect(await confirmationsSentTo(dayAfter.id)).toHaveLength(0);
});
