import { assistants, db, professionals, whatsappMessages } from '@acme/db';
import { asc, eq } from 'drizzle-orm';
import { formatMoney } from '../briefing/scripts';
import { messageItems } from '../conversations/history';
import { listThreadAssistants, speaker } from '../conversations/service';
import type { ConfirmationCard } from '../conversations/tools';
import { isCustomerWorking } from '../conversations/turn';
import { hasEnded, type JobDetail, jobStatus, jobSteps, listJobs, type Pill } from '../jobs/progress';
import { daysAgo, localTime, shortDate, shortDay } from '../visits/time';
import { readMessage } from '../whatsapp/service';
import { type Customer, findCustomer, formatPhoneNumber } from './service';

const paymentMethodLabels = { pix: 'Pix', cash: 'Dinheiro' } as const;

type Row = { label: string; value: string };
type Item = { id: string; at: Date } & (
  | { type: 'past_job'; date: string; title: string; detail: string; status: Pill }
  | { type: 'job_start'; title: string }
  | { type: 'visit'; title: string; detail: string; status: Pill }
  | { type: 'work_record'; label: string; when: string; rows: Row[]; transcript: string[] }
  | { type: 'quote'; total: string; detail: string; status: Pill }
  | { type: 'pix'; amount: string; detail: string; status: Pill }
  | { type: 'whatsapp'; direction: 'outbound' | 'inbound'; label: string; text: string; buttons: string[] }
  | { type: 'professional'; text: string }
  | { type: 'assistant'; text: string; assistant: ReturnType<typeof speaker> }
  | { type: 'handoff'; text: string; assistant: ReturnType<typeof speaker>; to: ReturnType<typeof speaker> }
  | ({ type: 'confirmation'; status: 'pending' | 'confirmed' | 'cancelled' } & ConfirmationCard)
);
type DayItem = { type: 'day'; id: string; label: string };

export type CustomerThread = NonNullable<Awaited<ReturnType<typeof getCustomerThread>>>;

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
  items.push(...(await whatsappItems(customer, details, current)));
  items.push(...(await teamItems(professionalId, customer.id, details, current)));
  // The Job starts at its first record when that came before the Job row (the migration's older records).
  const rank = { past_job: 0, job_start: 1 } as Partial<Record<Item['type'], number>>;
  items.sort((a, b) => a.at.getTime() - b.at.getTime() || (rank[a.type] ?? 2) - (rank[b.type] ?? 2));

  return {
    customer: { id: customer.id, name: customer.name, phoneNumber: formatPhoneNumber(customer.phoneNumber) },
    working: isCustomerWorking(customer.id),
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

// The WhatsApp exchanged with the Customer; what belongs to an earlier Job stays inside its card.
async function whatsappItems(customer: Customer, details: JobDetail[], current: JobDetail | undefined) {
  // The Customer's records are this Professional's, so a message about one of them is this thread's.
  const jobOf = new Map<string, string>();
  for (const { job, visits, quotes, charges } of details) {
    for (const { id } of [...visits, ...quotes, ...charges]) jobOf.set(id, job.id);
  }
  // M1 sends every Professional's messages from the platform's number, so the phone number alone is shared.
  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waId, customer.phoneNumber))
    .orderBy(asc(whatsappMessages.createdAt));
  const first = customer.name.split(' ')[0];
  const items: Item[] = [];
  // Free text answers no message in particular: it belongs to whoever wrote to the number last.
  let lastIsOurs = false;
  let previous = 0;
  for (const message of messages) {
    // Meta's timestamp on what arrives has whole seconds, so a message is never placed before one received earlier.
    const at = new Date(Math.max(message.sentAt.getTime(), previous + 1));
    previous = at.getTime();
    const jobId = message.originId ? jobOf.get(message.originId) : undefined;
    const ours: boolean = message.originId ? !!jobId : message.direction === 'inbound' && lastIsOurs;
    if (message.originId || message.direction === 'outbound') lastIsOurs = ours;
    if (!ours || (jobId && jobId !== current?.job.id)) continue;
    const { text, buttons } = readMessage(message);
    if (!text) continue;
    const outbound = message.direction === 'outbound';
    items.push({
      type: 'whatsapp',
      id: `whatsapp:${message.id}`,
      at,
      direction: message.direction,
      label: outbound ? `Enviado ao ${first} no WhatsApp` : `${first} no WhatsApp`,
      text,
      buttons,
    });
  }
  return items;
}

// What the Professional told the team here and what the Assistants answered; what belongs to an earlier Job stays inside its card.
async function teamItems(professionalId: string, customerId: string, details: JobDetail[], current?: JobDetail) {
  const earlier = new Set(details.filter((detail) => detail !== current).map(({ job }) => job.id));
  const items: Item[] = [];
  const team = await db
    .select({ id: assistants.id, name: assistants.name, role: assistants.role })
    .from(assistants)
    .where(eq(assistants.professionalId, professionalId));
  for (const assistant of await listThreadAssistants(professionalId, customerId)) {
    for (const message of await messageItems(assistant, customerId)) {
      if (message.jobId && earlier.has(message.jobId)) continue;
      const { at } = message;
      for (const item of message.items) {
        if (item.type === 'professional') items.push({ ...item, at });
        else if (item.type === 'assistant') items.push({ ...item, at, assistant: speaker(assistant) });
        else if (item.type === 'handoff') {
          const to = team.find(({ role }) => role === item.role);
          if (to)
            items.push({
              type: 'handoff',
              id: item.id,
              at,
              text: item.text,
              assistant: speaker(assistant),
              to: speaker(to),
            });
        } else if (item.type === 'confirmation') items.push({ ...item, at });
      }
    }
  }
  return items;
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
