import { assistants, db, professionals } from '@acme/db';
import { and, eq } from 'drizzle-orm';
import { type ConstructorOptions, type JobWithMetadata, PgBoss } from 'pg-boss';
import { confirmations, followUp } from '../briefing/scripts';
import { remindDueCharges } from '../charges/service';
import { followUpDueQuotes } from '../quotes/service';
import type { AssistantRole } from '../team/catalog';
import { requestDueVisitConfirmations } from '../visits/service';
import { localDate, nextDay, toInstant } from '../visits/time';

// One pg-boss queue per kind of Routine; each Assistant's Routine is a cron entry in it, keyed by the Assistant's id.
const visitConfirmationsQueue = 'visit-confirmations';
const quoteFollowUpsQueue = 'quote-follow-ups';
const chargeRemindersQueue = 'charge-reminders';
const queues: Partial<Record<AssistantRole, string>> = {
  scheduling: visitConfirmationsQueue,
  quotes: quoteFollowUpsQueue,
  billing: chargeRemindersQueue,
};
// Follow-ups and reminders are checked every hour of the day, so one that comes due at night waits for the morning.
const followUpCron = '0 8-20 * * *';

type RoutineRun = JobWithMetadata<{ assistantId: string }>;

let started: Promise<PgBoss> | undefined;

// The API process runs the Routines; tests pass their own schema and a TestClock.
export function startRoutines(options: Omit<ConstructorOptions, 'connectionString'> = {}) {
  started = start(options, true);
  return started;
}

export async function stopRoutines() {
  const boss = await started;
  started = undefined;
  await boss?.stop();
}

// Without startRoutines (a test that only approves a Playbook), Routines are saved but none runs.
function routines() {
  started ??= start({ schedule: false }, false);
  return started;
}

async function start(options: Omit<ConstructorOptions, 'connectionString'>, work: boolean) {
  const boss = new PgBoss({ connectionString: env('DATABASE_URL'), ...options });
  boss.on('error', (error) => console.error('Routines:', error));
  await boss.start();
  for (const queue of Object.values(queues)) {
    await boss.createQueue(queue, { retryLimit: 5, retryDelay: 60, retryBackoff: true });
  }
  if (work) {
    await boss.work(visitConfirmationsQueue, { includeMetadata: true }, ([run]: RoutineRun[]) =>
      runVisitConfirmations(run!),
    );
    await boss.work(quoteFollowUpsQueue, { includeMetadata: true }, ([run]: RoutineRun[]) => runQuoteFollowUps(run!));
    await boss.work(chargeRemindersQueue, { includeMetadata: true }, ([run]: RoutineRun[]) => runChargeReminders(run!));
  }
  return boss;
}

export async function findRoutine(assistantId: string) {
  const boss = await routines();
  for (const queue of Object.values(queues)) {
    const schedule = await boss.getSchedule(queue, assistantId);
    if (schedule) return schedule;
  }
  return null;
}

// Called whenever an Assistant's Playbook may have changed: the Routine follows what the approved Playbook says.
export async function syncRoutines(assistantId: string) {
  const boss = await routines();
  const [assistant] = await db
    .select({
      role: assistants.role,
      playbook: assistants.playbook,
      playbookStatus: assistants.playbookStatus,
      timezone: professionals.timezone,
    })
    .from(assistants)
    .innerJoin(professionals, eq(professionals.id, assistants.professionalId))
    .where(eq(assistants.id, assistantId));
  const queue = assistant && queues[assistant.role];
  if (!queue) return;
  const cron = assistant.playbookStatus === 'approved' ? routineCron(assistant.role, assistant.playbook) : null;
  if (!cron) {
    await boss.unschedule(queue, assistantId);
    return;
  }
  // A run missed while the API was down still goes out once when it comes back.
  await boss.schedule(queue, cron, { assistantId }, { tz: assistant.timezone, key: assistantId, missed: 'once' });
}

function routineCron(role: AssistantRole, playbook: unknown) {
  const fields = playbook as Record<string, unknown>;
  if (role === 'scheduling') {
    const time = confirmations.safeParse(fields.confirmations).data?.time;
    if (!time) return null;
    const [hour, minute] = time.split(':').map(Number);
    return `${minute} ${hour} * * *`;
  }
  if (role === 'quotes') {
    const action = followUp.safeParse(fields.followUp).data?.action;
    return action === 'remind' || action === 'notify_me' ? followUpCron : null;
  }
  // The billing Briefing has no step for reminders yet, so every approved billing Playbook gets the spec's default.
  if (role === 'billing') return followUpCron;
  return null;
}

async function runVisitConfirmations({ data: { assistantId }, createdOn }: RoutineRun) {
  const assistant = await findRoutineAssistant(assistantId, 'scheduling');
  const parsed = confirmations.safeParse(assistant?.playbook.confirmations);
  if (!assistant || parsed.data?.time == null) return;
  // A run caught up after downtime is created late, so its day is that of the last slot at or before createdOn.
  const today = localDate(createdOn, assistant.timezone);
  const slotPassed = toInstant(today, parsed.data.time, assistant.timezone) <= createdOn;
  const due = slotPassed ? today : localDate(new Date(createdOn.getTime() - 86_400_000), assistant.timezone);
  await requestDueVisitConfirmations(
    { id: assistant.professionalId, name: assistant.professionalName, timezone: assistant.timezone },
    parsed.data.when === 'day_before' ? nextDay(due) : due,
  );
}

async function runQuoteFollowUps({ data: { assistantId }, createdOn }: RoutineRun) {
  const assistant = await findRoutineAssistant(assistantId, 'quotes');
  const parsed = followUp.safeParse(assistant?.playbook.followUp);
  if (!assistant || !parsed.success) return;
  const { action, afterDays } = parsed.data;
  if (action === 'nothing' || afterDays === null) return;
  await followUpDueQuotes(
    { id: assistant.professionalId, name: assistant.professionalName, timezone: assistant.timezone },
    { action, afterDays },
    createdOn,
  );
}

async function runChargeReminders({ data: { assistantId }, createdOn }: RoutineRun) {
  const assistant = await findRoutineAssistant(assistantId, 'billing');
  if (!assistant) return;
  await remindDueCharges(
    { id: assistant.professionalId, name: assistant.professionalName, timezone: assistant.timezone },
    createdOn,
  );
}

async function findRoutineAssistant(assistantId: string, role: AssistantRole) {
  const [row] = await db
    .select({
      playbook: assistants.playbook,
      professionalId: professionals.id,
      professionalName: professionals.name,
      timezone: professionals.timezone,
    })
    .from(assistants)
    .innerJoin(professionals, eq(professionals.id, assistants.professionalId))
    .where(and(eq(assistants.id, assistantId), eq(assistants.role, role), eq(assistants.playbookStatus, 'approved')));
  return row && { ...row, playbook: row.playbook as Record<string, unknown> };
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
