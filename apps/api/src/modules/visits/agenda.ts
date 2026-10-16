import { db, workRecords } from '@acme/db';
import { inArray } from 'drizzle-orm';
import { hasEnded, jobStatus, listJobs } from '../jobs/progress';
import { addDays, dayMonth, localDate, localTime, shortWeekday } from '../time/time';
import { confirmationsCard } from './confirmation-card';
import { listVisits } from './service';

// The "Agenda" card for the period Claude read after @agenda, with the Visits as they are now.
export async function agendaCard(
  professional: { id: string; timezone: string },
  from: string,
  to: string,
  now = new Date(),
) {
  const { id: professionalId, timezone } = professional;
  const found = await listVisits(professionalId, timezone, from, to);
  const details = await listJobs(professionalId, [...new Set(found.map(({ customer }) => customer.id))]);
  const told = found.length
    ? await db
        .select({ visitId: workRecords.visitId })
        .from(workRecords)
        .where(
          inArray(
            workRecords.visitId,
            found.map(({ id }) => id),
          ),
        )
    : [];
  const when = (scheduledAt: Date) => {
    const time = localTime(scheduledAt, timezone);
    return from === to ? time : `${shortWeekday(localDate(scheduledAt, timezone))}, ${time}`;
  };
  // As in the prototype: one day shows the time in the first column; more days show the weekday there, the time after.
  const rows = found.map((visit) => {
    const detail = details.find(({ job }) => job.id === visit.jobId)!;
    const time = localTime(visit.scheduledAt, timezone);
    const oneDay = from === to;
    return {
      visitId: visit.id,
      customerId: visit.customer.id,
      customerName: visit.customer.name,
      when: oneDay ? time : shortWeekday(localDate(visit.scheduledAt, timezone)),
      detail: oneDay ? detail.job.title : `${time} · ${detail.job.title}`,
      status: jobStatus(detail, visit, now),
    };
  });
  const toAsk = found.filter(
    (visit) =>
      visit.status === 'scheduled' && !hasEnded(visit, now) && !told.some(({ visitId }) => visitId === visit.id),
  );
  const firstOfEach = [...new Map(toAsk.toReversed().map((visit) => [visit.customer.id, visit])).values()].reverse();
  const count = found.length === 0 ? 'Nenhuma visita' : found.length === 1 ? '1 visita' : `${found.length} visitas`;
  return {
    title: 'Agenda',
    subtitle: `${period(from, to, localDate(now, timezone))} · ${count}`,
    rows,
    confirmation: firstOfEach.length
      ? confirmationsCard(
          firstOfEach.map((visit) => ({ visitId: visit.id, name: visit.customer.name, when: when(visit.scheduledAt) })),
          'Para confirmar: pedir a confirmação da agenda',
        )
      : null,
  };
}

// "Hoje, 16 out", "Amanhã, 17 out", "Semana que vem, 19 a 23 out" or "28 out a 3 nov".
function period(from: string, to: string, today: string) {
  if (from === to) {
    const named = { [today]: 'Hoje', [addDays(today, 1)]: 'Amanhã', [addDays(today, -1)]: 'Ontem' }[from];
    return `${named ?? shortWeekday(from)}, ${dayMonth(from)}`;
  }
  const [, fromMonth] = from.split('-');
  const [, toMonth] = to.split('-');
  const range =
    fromMonth === toMonth ? `${dayMonth(from).split(' ')[0]} a ${dayMonth(to)}` : `${dayMonth(from)} a ${dayMonth(to)}`;
  const thisMonday = mondayOf(today);
  const week = { [thisMonday]: 'Esta semana', [addDays(thisMonday, 7)]: 'Semana que vem' }[from];
  return week ? `${week}, ${range}` : range;
}

function mondayOf(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}
