export type RoutineAssistant = {
  playbook: Record<string, unknown>;
  professional: { id: string; name: string; timezone: string };
};

// One pg-boss queue per Role; the cron comes from the approved Playbook, or null for no Routine.
export type Routine = {
  queue: string;
  cron: (playbook: Record<string, unknown>) => string | null;
  run: (assistant: RoutineAssistant, createdOn: Date) => Promise<void>;
};

// Follow-ups and reminders are checked every hour of the day, so one that comes due at night waits for the morning.
export const followUpCron = '0 8-20 * * *';
