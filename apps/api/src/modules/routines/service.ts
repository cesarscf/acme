import { assistants, db, professionals } from '@acme/db';
import { and, eq } from 'drizzle-orm';
import { type ConstructorOptions, type JobWithMetadata, PgBoss } from 'pg-boss';
import { confirmations } from '../briefing/scripts';
import { requestDueVisitConfirmations } from '../visits/service';
import { localDate, nextDay, toInstant } from '../visits/time';

// One pg-boss queue per kind of Routine; each Assistant's Routine is a cron entry in it, keyed by the Assistant's id.
const visitConfirmationsQueue = 'visit-confirmations';

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
  await boss.createQueue(visitConfirmationsQueue, { retryLimit: 5, retryDelay: 60, retryBackoff: true });
  if (work) {
    await boss.work(visitConfirmationsQueue, { includeMetadata: true }, ([run]: RoutineRun[]) =>
      runVisitConfirmations(run!),
    );
  }
  return boss;
}

export async function findRoutine(assistantId: string) {
  return (await routines()).getSchedule(visitConfirmationsQueue, assistantId);
}

// Called whenever an Assistant's Playbook may have changed: the Routine follows what the approved Playbook says.
export async function syncRoutines(assistantId: string) {
  const boss = await routines();
  const assistant = await findRoutineAssistant(assistantId);
  const parsed = confirmations.safeParse(assistant?.playbook.confirmations);
  if (!assistant || !parsed.success || parsed.data.time === null) {
    await boss.unschedule(visitConfirmationsQueue, assistantId);
    return;
  }
  const [hour, minute] = parsed.data.time.split(':').map(Number);
  await boss.schedule(
    visitConfirmationsQueue,
    `${minute} ${hour} * * *`,
    { assistantId },
    // A run missed while the API was down still goes out once when it comes back.
    { tz: assistant.timezone, key: assistantId, missed: 'once' },
  );
}

async function runVisitConfirmations({ data: { assistantId }, createdOn }: RoutineRun) {
  const assistant = await findRoutineAssistant(assistantId);
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

async function findRoutineAssistant(assistantId: string) {
  const [row] = await db
    .select({
      playbook: assistants.playbook,
      professionalId: professionals.id,
      professionalName: professionals.name,
      timezone: professionals.timezone,
    })
    .from(assistants)
    .innerJoin(professionals, eq(professionals.id, assistants.professionalId))
    .where(
      and(eq(assistants.id, assistantId), eq(assistants.role, 'scheduling'), eq(assistants.playbookStatus, 'approved')),
    );
  return row && { ...row, playbook: row.playbook as Record<string, unknown> };
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
