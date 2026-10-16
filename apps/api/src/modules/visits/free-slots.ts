import { assistants, db } from '@acme/db';
import { and, eq } from 'drizzle-orm';
import { addDays, localDate, toInstant } from '../time/time';
import { hours, weekdays } from './briefing';
import { listVisits } from './service';

// Before the scheduling Briefing, the hours are the Briefing's first option.
const defaultHours: Hours = [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' }];
const searchDays = 14;
type Hours = ReturnType<typeof hours.parse>;

// The first whole hours, from tomorrow on, inside the Playbook's hours and clear of every Visit.
export async function freeSlots(
  professionalId: string,
  timeZone: string,
  { count = 2, durationMinutes = 60, now = new Date() } = {},
) {
  const [scheduling] = await db
    .select({ playbook: assistants.playbook })
    .from(assistants)
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, 'scheduling')));
  const parsed = hours.safeParse((scheduling?.playbook as Record<string, unknown> | undefined)?.hours);
  const windows = parsed.success ? parsed.data : defaultHours;
  const from = addDays(localDate(now, timeZone), 1);
  const to = addDays(from, searchDays);
  const busy = (await listVisits(professionalId, timeZone, from, to)).map(({ scheduledAt, durationMinutes }) => ({
    start: scheduledAt.getTime(),
    end: scheduledAt.getTime() + durationMinutes * 60_000,
  }));
  const slots: Date[] = [];
  for (let day = from; day <= to && slots.length < count; day = addDays(day, 1)) {
    // Mon = 0 in the Playbook; getUTCDay counts from Sunday.
    const weekday = weekdays[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]!;
    for (const { days, start, end } of windows) {
      if (!days.includes(weekday)) continue;
      const close = toInstant(day, end, timeZone).getTime();
      for (
        let slot = toInstant(day, start, timeZone).getTime();
        slot + durationMinutes * 60_000 <= close;
        slot += 3_600_000
      ) {
        const slotEnd = slot + durationMinutes * 60_000;
        if (busy.some((visit) => visit.start < slotEnd && visit.end > slot)) continue;
        slots.push(new Date(slot));
        if (slots.length === count) return slots;
      }
    }
  }
  return slots;
}
