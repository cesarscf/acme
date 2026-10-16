import { assistants, db, professionals } from '@acme/db';
import { and, eq } from 'drizzle-orm';
import { type ConstructorOptions, type JobWithMetadata, PgBoss } from 'pg-boss';
import type { AssistantRole } from '../team/catalog';
import { roles } from '../team/roles';
import type { RoutineAssistant } from './routine';

// Each Assistant's Routine is a cron entry in its Role's queue, keyed by the Assistant's id.
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

function roleRoutines() {
  return Object.entries(roles).map(([role, { routine }]) => ({ role: role as AssistantRole, routine }));
}

async function start(options: Omit<ConstructorOptions, 'connectionString'>, work: boolean) {
  const boss = new PgBoss({ connectionString: env('DATABASE_URL'), ...options });
  boss.on('error', (error) => console.error('Routines:', error));
  await boss.start();
  for (const { routine } of roleRoutines()) {
    await boss.createQueue(routine.queue, { retryLimit: 5, retryDelay: 60, retryBackoff: true });
  }
  if (work) {
    for (const { role, routine } of roleRoutines()) {
      await boss.work(routine.queue, { includeMetadata: true }, async ([run]: RoutineRun[]) => {
        const assistant = await findRoutineAssistant(run!.data.assistantId, role);
        if (assistant) await routine.run(assistant, run!.createdOn);
      });
    }
  }
  return boss;
}

export async function findRoutine(assistantId: string) {
  const boss = await routines();
  for (const { routine } of roleRoutines()) {
    const schedule = await boss.getSchedule(routine.queue, assistantId);
    if (schedule) return schedule;
  }
  return null;
}

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
  if (!assistant) return;
  const { routine } = roles[assistant.role];
  const cron =
    assistant.playbookStatus === 'approved' ? routine.cron(assistant.playbook as Record<string, unknown>) : null;
  if (!cron) {
    await boss.unschedule(routine.queue, assistantId);
    return;
  }
  // A run missed while the API was down still goes out once when it comes back.
  await boss.schedule(
    routine.queue,
    cron,
    { assistantId },
    { tz: assistant.timezone, key: assistantId, missed: 'once' },
  );
}

async function findRoutineAssistant(assistantId: string, role: AssistantRole): Promise<RoutineAssistant | undefined> {
  const [row] = await db
    .select({
      playbook: assistants.playbook,
      professional: { id: professionals.id, name: professionals.name, timezone: professionals.timezone },
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
