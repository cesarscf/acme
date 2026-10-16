import { charges, db, jobs, quotes, visits, workRecords } from '@acme/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { formatWholeMoney } from '../charges/service';
import { daysAgo, localDate } from '../time/time';

export type Tone = 'ok' | 'wait' | 'none' | 'sent';
export type Pill = { label: string; tone: Tone };
export type StepState = 'done' | 'current' | 'todo' | 'optional' | 'skipped';
type Visit = typeof visits.$inferSelect;
export type JobDetail = Awaited<ReturnType<typeof listJobs>>[number];

// Each Job with what it gathers, oldest first.
export async function listJobs(professionalId: string, customerIds: string[]) {
  if (!customerIds.length) return [];
  const [jobRows, visitRows, quoteRows, workRecordRows, chargeRows] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.professionalId, professionalId), inArray(jobs.customerId, customerIds)))
      .orderBy(asc(jobs.openedAt)),
    db
      .select()
      .from(visits)
      .where(and(eq(visits.professionalId, professionalId), inArray(visits.customerId, customerIds)))
      .orderBy(asc(visits.scheduledAt)),
    db
      .select()
      .from(quotes)
      .where(and(eq(quotes.professionalId, professionalId), inArray(quotes.customerId, customerIds)))
      .orderBy(asc(quotes.createdAt)),
    db
      .select()
      .from(workRecords)
      .where(and(eq(workRecords.professionalId, professionalId), inArray(workRecords.customerId, customerIds)))
      .orderBy(asc(workRecords.createdAt)),
    db
      .select()
      .from(charges)
      .where(and(eq(charges.professionalId, professionalId), inArray(charges.customerId, customerIds)))
      .orderBy(asc(charges.createdAt)),
  ]);
  return jobRows.map((job) => {
    const ownWorkRecords = workRecordRows.filter(({ jobId }) => jobId === job.id);
    const workRecordIds = new Set(ownWorkRecords.map(({ id }) => id));
    return {
      job,
      visits: visitRows.filter(({ jobId }) => jobId === job.id),
      quotes: quoteRows.filter(({ jobId }) => jobId === job.id),
      workRecords: ownWorkRecords,
      charges: chargeRows.filter(({ workRecordId }) => workRecordIds.has(workRecordId)),
    };
  });
}

export function hasEnded(visit: Visit, now = new Date()) {
  return visit.scheduledAt.getTime() + visit.durationMinutes * 60_000 <= now.getTime();
}

export function facts(detail: JobDetail) {
  const quote = detail.quotes.at(-1);
  const sentPix = detail.charges.findLast(
    ({ paymentMethod, sentAt, status }) => paymentMethod === 'pix' && sentAt && status !== 'cancelled',
  );
  const service = detail.workRecords.findLast(({ amountCents }) => amountCents !== null);
  // The Visit booked after the Quote went out is the one that carries out the service.
  const executionBooked =
    quote?.status === 'approved' &&
    detail.visits.some(({ status, createdAt }) => status !== 'cancelled' && quote.sentAt && createdAt > quote.sentAt);
  return {
    quote,
    sentPix,
    service,
    executionBooked,
    paid: detail.charges.some(({ status }) => status === 'paid'),
    recorded: detail.workRecords.length > 0,
  };
}

// The Job's status pill, as the list, the pinned Job and the Visit card show it; a Visit narrows it to that Visit.
export function jobStatus(detail: JobDetail, visit?: Visit, now = new Date()): Pill {
  const { quote, sentPix, service, executionBooked, paid, recorded } = facts(detail);
  if (paid) return { label: 'Pago', tone: 'ok' };
  if (detail.job.status === 'declined') return { label: 'Recusado', tone: 'none' };
  if (sentPix) return { label: 'Pix enviado', tone: 'sent' };
  if (service) return { label: 'A cobrar', tone: 'wait' };
  if (quote?.status === 'sent') return { label: 'Orçamento enviado', tone: 'sent' };
  if (quote?.status === 'draft') return { label: 'Orçamento', tone: 'none' };
  if (quote?.status === 'approved' && !executionBooked) return { label: 'Aprovado', tone: 'ok' };
  const current = visit ?? detail.visits.findLast(({ status }) => status !== 'cancelled');
  if (!current) return { label: recorded ? 'Visitado' : 'Em aberto', tone: 'none' };
  if (hasEnded(current, now) || detail.workRecords.some(({ visitId }) => visitId === current.id)) {
    return { label: 'Visitado', tone: 'none' };
  }
  if (current.status === 'confirmed') return { label: 'Confirmado', tone: 'ok' };
  if (current.status === 'reschedule_requested') return { label: 'Pediu para remarcar', tone: 'wait' };
  if (current.confirmationRequestedFor?.getTime() === current.scheduledAt.getTime()) {
    return { label: 'Sem resposta', tone: 'wait' };
  }
  return { label: 'Não enviado', tone: 'none' };
}

// Visita → Orçamento → Serviço → Pagamento; only the first step still open is current.
export function jobSteps(detail: JobDetail) {
  const { quote, service, executionBooked, paid, recorded } = facts(detail);
  const quoteState: StepState =
    quote?.status === 'approved' ? 'done' : quote ? 'current' : service ? 'skipped' : 'optional';
  const steps: { label: string; state: StepState }[] = [
    { label: 'Visita', state: recorded ? 'done' : 'current' },
    { label: 'Orçamento', state: quoteState },
    { label: 'Serviço', state: service ? 'done' : executionBooked ? 'current' : 'todo' },
    { label: 'Pagamento', state: paid ? 'done' : service ? 'current' : 'todo' },
  ];
  let seen = false;
  return steps.map((step) => {
    if (step.state !== 'current') return step;
    if (seen) return { ...step, state: 'todo' as const };
    seen = true;
    return step;
  });
}

// What the Customer still owes the Job, for "Esperando o cliente"; null when nothing is pending on their side.
export function waitingFor(detail: JobDetail, timeZone: string, now = new Date()) {
  if (detail.job.status !== 'open') return null;
  const { quote, sentPix, service, executionBooked } = facts(detail);
  if (sentPix && sentPix.status !== 'paid')
    return `Pix de ${formatWholeMoney(sentPix.amountCents)} · esperando pagamento`;
  if (service && !sentPix) return `Serviço de ${formatWholeMoney(service.amountCents!)} · falta cobrar`;
  if (quote?.status === 'sent' && quote.sentAt) {
    return `Orçamento de ${formatWholeMoney(quote.totalCents)} · enviado ${relativeDay(quote.sentAt, timeZone, now)}`;
  }
  if (quote?.status === 'approved' && !executionBooked) return 'Orçamento aprovado · falta marcar';
  return null;
}

// When anything last happened in the Job.
export function lastActivity(detail: JobDetail) {
  const moments = [
    detail.job.openedAt,
    detail.job.closedAt,
    ...detail.visits.map(({ createdAt }) => createdAt),
    ...detail.quotes.map(({ sentAt, createdAt }) => sentAt ?? createdAt),
    ...detail.workRecords.map(({ createdAt }) => createdAt),
    ...detail.charges.flatMap(({ sentAt, paidAt }) => [sentAt, paidAt]),
  ];
  return new Date(Math.max(...moments.filter((moment) => moment !== null).map((moment) => moment.getTime())));
}

export function relativeDay(instant: Date, timeZone: string, now = new Date()) {
  const days = daysAgo(instant, timeZone, now);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  const [, month, day] = localDate(instant, timeZone).split('-');
  return `${day}/${month}`;
}
