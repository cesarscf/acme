import { customers, db, visits, workRecords } from '@acme/db';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { TimedItems } from '../conversations/history';
import type { Assistant } from '../conversations/service';
import { formatLocalDateTime } from './time';

// Same window as the Visits a WorkRecord can be about.
const endedVisitDays = 7;

// The notice of an approved Quote offers to book the Visit; accepting sends this message, as if typed.
export const bookVisitSuggestion = {
  question: (customerName: string) => `Quer que eu marque a visita de ${customerName}?`,
  message: (customerName: string) => `Marcar a visita de ${customerName}`,
};

// Each Visit that ended in the last days asks, in the scheduling chat, how it went.
export async function endedVisitSuggestions({ professional }: Assistant): Promise<TimedItems[]> {
  const now = new Date();
  const endsAt = sql<Date>`${visits.scheduledAt} + make_interval(mins => ${visits.durationMinutes})`;
  const ended = await db
    .select({
      id: visits.id,
      scheduledAt: visits.scheduledAt,
      endsAt: endsAt.mapWith((value: string) => new Date(value)),
      customerName: customers.name,
    })
    .from(visits)
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .where(
      and(
        eq(visits.professionalId, professional.id),
        inArray(visits.status, ['scheduled', 'confirmed']),
        gte(visits.scheduledAt, new Date(now.getTime() - endedVisitDays * 86_400_000)),
        sql`${endsAt} <= ${now.toISOString()}`,
      ),
    );
  const recorded = ended.length
    ? await db
        .select({ id: workRecords.id, visitId: workRecords.visitId })
        .from(workRecords)
        .where(
          inArray(
            workRecords.visitId,
            ended.map(({ id }) => id),
          ),
        )
    : [];
  return ended.map((visit) => ({
    at: visit.endsAt,
    jobId: null,
    items: [
      {
        id: visit.id,
        type: 'suggestion' as const,
        action: 'record_work' as const,
        question: `Terminou a visita de ${visit.customerName}, ${formatLocalDateTime(visit.scheduledAt, professional.timezone)}?`,
        workRecordId: recorded.find(({ visitId }) => visitId === visit.id)?.id ?? null,
      },
    ],
  }));
}
