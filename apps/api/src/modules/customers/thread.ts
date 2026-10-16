import { db, professionals } from '@acme/db';
import { eq } from 'drizzle-orm';
import { formatMoney } from '../briefing/scripts';
import { hasEnded, type JobDetail, jobStatus, jobSteps, listJobs, type Pill } from '../jobs/progress';
import { daysAgo, localTime, shortDate, shortDay } from '../visits/time';
import { findCustomer, formatPhoneNumber } from './service';

const paymentMethodLabels = { pix: 'Pix', cash: 'Dinheiro' } as const;

type Row = { label: string; value: string };
type Item = { id: string; at: Date } & (
  | { type: 'past_job'; date: string; title: string; detail: string; status: Pill }
  | { type: 'job_start'; title: string }
  | { type: 'visit'; title: string; detail: string; status: Pill }
  | { type: 'work_record'; label: string; when: string; rows: Row[]; transcript: string[] }
  | { type: 'quote'; total: string; detail: string; status: Pill }
  | { type: 'pix'; amount: string; detail: string; status: Pill }
);
type DayItem = { type: 'day'; id: string; label: string };

// The Customer's conversation: the Job in progress pinned on top, earlier Jobs as compact cards, the rest in time order.
export async function getCustomerThread(professionalId: string, customerId: string, now = new Date()) {
  const customer = await findCustomer(professionalId, customerId);
  if (!customer) return undefined;
  const [professional] = await db
    .select({ timezone: professionals.timezone })
    .from(professionals)
    .where(eq(professionals.id, professionalId));
  const timeZone = professional!.timezone;
  const details = await listJobs(professionalId, [customer.id]);
  const current = pinnedJob(details, timeZone, now);

  const items: Item[] = [];
  for (const detail of details) {
    if (detail === current) items.push(...jobItems(detail, customer.name, timeZone, now));
    else items.push(pastJob(detail, timeZone));
  }
  // The Job starts at its first record when that came before the Job row (the migration's older records).
  const rank = { past_job: 0, job_start: 1 } as Partial<Record<Item['type'], number>>;
  items.sort((a, b) => a.at.getTime() - b.at.getTime() || (rank[a.type] ?? 2) - (rank[b.type] ?? 2));

  return {
    customer: { id: customer.id, name: customer.name, phoneNumber: formatPhoneNumber(customer.phoneNumber) },
    pinned: current
      ? {
          label: current.job.status === 'open' ? 'EM ANDAMENTO' : 'CONCLUÍDO',
          title: current.job.title,
          status: jobStatus(current, undefined, now),
          steps: jobSteps(current),
        }
      : null,
    items: withDays(items, timeZone, now),
  };
}

// The open Job; a Job paid today stays pinned as CONCLUÍDO until the day ends.
function pinnedJob(details: JobDetail[], timeZone: string, now: Date) {
  const open = details.find(({ job }) => job.status === 'open');
  if (open) return open;
  const last = details.at(-1);
  if (last?.job.status === 'done' && last.job.closedAt && daysAgo(last.job.closedAt, timeZone, now) === 0) return last;
}

function pastJob(detail: JobDetail, timeZone: string): Item {
  const { job, workRecords } = detail;
  const at = job.closedAt ?? job.openedAt;
  const service = workRecords.findLast(({ amountCents }) => amountCents !== null);
  return {
    type: 'past_job',
    id: `past_job:${job.id}`,
    at,
    date: shortDate(at, timeZone),
    title: job.title,
    detail: service
      ? `${formatMoney(service.amountCents!)} · ${paymentMethodLabels[service.paymentMethod]}`
      : job.status === 'declined'
        ? 'Orçamento recusado'
        : '',
    status: jobStatus(detail),
  };
}

function jobItems(detail: JobDetail, customerName: string, timeZone: string, now: Date): Item[] {
  const { job } = detail;
  const items: Item[] = [];

  for (const visit of detail.visits) {
    const status: Pill =
      visit.status === 'cancelled'
        ? { label: 'Cancelada', tone: 'none' }
        : hasEnded(visit, now)
          ? { label: 'Feita', tone: 'ok' }
          : jobStatus(detail, visit, now);
    items.push({
      type: 'visit',
      id: `visit:${visit.id}`,
      at: visit.createdAt,
      title: `${job.title} · ${shortDay(visit.scheduledAt, timeZone)}, ${localTime(visit.scheduledAt, timeZone)}`,
      detail: customerName,
      status,
    });
  }

  for (const workRecord of detail.workRecords) {
    const service = workRecord.amountCents !== null;
    const rows: Row[] = [{ label: 'Cliente', value: customerName }];
    const said = workRecord.description ?? workRecord.title;
    if (said) rows.push({ label: service ? 'Serviço' : 'O que viu', value: said });
    if (workRecord.materials) rows.push({ label: 'Material', value: workRecord.materials });
    if (service) {
      rows.push({
        label: 'Valor',
        value: `${formatMoney(workRecord.amountCents!)} · ${paymentMethodLabels[workRecord.paymentMethod]}`,
      });
    }
    items.push({
      type: 'work_record',
      id: `work_record:${workRecord.id}`,
      at: workRecord.createdAt,
      label: service ? 'Serviço registrado' : 'Visita registrada',
      when: `${dayLabel(workRecord.createdAt, timeZone, now)}, ${localTime(workRecord.createdAt, timeZone)}`,
      rows,
      transcript: workRecord.transcript.split('\n').filter((line) => line.trim()),
    });
  }

  for (const quote of detail.quotes) {
    if (!quote.sentAt) continue;
    items.push({
      type: 'quote',
      id: `quote:${quote.id}`,
      at: quote.sentAt,
      total: formatMoney(quote.totalCents),
      detail: `Orçamento para ${customerName} · enviado no WhatsApp`,
      status:
        quote.status === 'approved'
          ? { label: 'Aprovado', tone: 'ok' }
          : quote.status === 'declined'
            ? { label: 'Recusado', tone: 'none' }
            : { label: 'Aguardando resposta', tone: 'wait' },
    });
  }

  for (const charge of detail.charges) {
    if (charge.paymentMethod !== 'pix' || !charge.sentAt || charge.status === 'cancelled') continue;
    items.push({
      type: 'pix',
      id: `pix:${charge.id}`,
      at: charge.sentAt,
      amount: formatMoney(charge.amountCents),
      detail: `Pix para ${customerName} · enviado no WhatsApp`,
      status:
        charge.status === 'paid' && charge.paidAt
          ? { label: `Pago às ${localTime(charge.paidAt, timeZone)}`, tone: 'ok' }
          : { label: 'Aguardando pagamento', tone: 'none' },
    });
  }

  const first = Math.min(job.openedAt.getTime(), ...items.map(({ at }) => at.getTime()));
  return [{ type: 'job_start', id: `job_start:${job.id}`, at: new Date(first), title: job.title }, ...items];
}

// A day divider before the first item of each day; the Job cards and dividers do not start a day.
function withDays(items: Item[], timeZone: string, now: Date) {
  const result: (Item | DayItem)[] = [];
  let lastDay: number | undefined;
  for (const item of items) {
    if (item.type !== 'past_job' && item.type !== 'job_start') {
      const day = daysAgo(item.at, timeZone, now);
      if (day !== lastDay) {
        result.push({ type: 'day', id: `day:${item.id}`, label: dayLabel(item.at, timeZone, now) });
        lastDay = day;
      }
    }
    result.push(item);
  }
  return result;
}

function dayLabel(instant: Date, timeZone: string, now: Date) {
  const days = daysAgo(instant, timeZone, now);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return shortDay(instant, timeZone);
}
