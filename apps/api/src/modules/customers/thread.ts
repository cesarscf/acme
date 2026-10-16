import { assistantNotices, assistants, db, professionals, whatsappMessages } from '@acme/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { formatMoney } from '../briefing/scripts';
import { chargePixCode, findPixAccount } from '../charges/service';
import { messageItems } from '../conversations/history';
import { isCustomerWorking } from '../conversations/running-turns';
import { type Assistant, listThreadAssistants, speaker } from '../conversations/service';
import type { ConfirmationCard } from '../conversations/tools';
import { facts, hasEnded, type JobDetail, jobStatus, jobSteps, listJobs, type Pill } from '../jobs/progress';
import { daysAgo, formatSlot, localTime, shortDate, shortDay } from '../time/time';
import { freeSlots } from '../visits/free-slots';
import { readMessage } from '../whatsapp/service';
import { type Customer, findCustomer, firstName, formatPhoneNumber } from './service';

const paymentMethodLabels = { pix: 'Pix', cash: 'Dinheiro' } as const;

type Row = { label: string; value: string };
type Item = { id: string; at: Date } & (
  | { type: 'past_job'; date: string; title: string; detail: string; status: Pill }
  | { type: 'job_start'; title: string }
  | { type: 'visit'; title: string; detail: string; status: Pill }
  | { type: 'work_record'; label: string; when: string; rows: Row[]; transcript: string[] }
  | { type: 'quote'; total: string; detail: string; status: Pill }
  | { type: 'pix'; chargeId: string; amount: string; detail: string; status: Pill; pixCode: string | null }
  | { type: 'whatsapp'; direction: 'outbound' | 'inbound'; label: string; text: string; buttons: string[] }
  | { type: 'line'; text: string }
  | { type: 'notice'; text: string }
  | {
      type: 'question';
      text: string;
      assistant: ReturnType<typeof speaker>;
      role: Assistant['role'];
      options: Option[];
    }
  | { type: 'professional'; text: string }
  | { type: 'assistant'; text: string; assistant: ReturnType<typeof speaker> }
  | { type: 'handoff'; text: string; assistant: ReturnType<typeof speaker>; to: ReturnType<typeof speaker> }
  | ({ type: 'confirmation'; status: 'pending' | 'confirmed' | 'cancelled' } & ConfirmationCard)
);
type DayItem = { type: 'day'; id: string; label: string };
type Team = { id: string; name: string; role: Assistant['role'] }[];
// An answer the Professional taps; it goes to the Assistant who asked, as if typed. "Outro" opens the field instead.
type Option = { label: string; hint?: string; other?: true };
// A next step above the field: its label goes to that Role's Assistant as if typed; without a Role, it records the Visit.
type Action = { key: string; label: string; done: boolean } & (
  | { role: Assistant['role'] }
  | { role: null; visitId: string }
);
type WhatsappMessage = typeof whatsappMessages.$inferSelect;

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
  const team = await db
    .select({ id: assistants.id, name: assistants.name, role: assistants.role })
    .from(assistants)
    .where(eq(assistants.professionalId, professionalId));

  const pixAccount = await findPixAccount(professionalId);

  const items: Item[] = [];
  for (const detail of details) {
    if (detail === current) items.push(...jobItems(detail, customer.name, { team, pixAccount, timeZone, now }));
    else items.push(pastJob(detail, timeZone));
  }
  // M1 sends every Professional's messages from the platform's number, so the phone number alone is shared.
  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waId, customer.phoneNumber))
    .orderBy(asc(whatsappMessages.createdAt));
  items.push(...whatsappItems(customer, messages, details, current));
  const scheduling = team.find(({ role }) => role === 'scheduling');
  if (current?.job.status === 'open' && scheduling) {
    const question = await executionQuestion(current, customer.name, speaker(scheduling), { timeZone, now });
    if (question) items.push(question);
  }
  items.push(...(await teamItems(professionalId, customer.id, team, details, current)));
  items.push(...(await noticeItems(professionalId, customer.id)));
  // The Job starts at its first record when that came before the Job row (the migration's older records).
  const rank = { past_job: 0, job_start: 1 } as Partial<Record<Item['type'], number>>;
  items.sort((a, b) => a.at.getTime() - b.at.getTime() || (rank[a.type] ?? 2) - (rank[b.type] ?? 2));

  return {
    customer: { id: customer.id, name: customer.name, phoneNumber: formatPhoneNumber(customer.phoneNumber) },
    working: await isCustomerWorking(customer.id),
    pinned: current
      ? {
          label: current.job.status === 'open' ? 'EM ANDAMENTO' : 'CONCLUÍDO',
          title: current.job.title,
          status: jobStatus(current, undefined, now),
          steps: jobSteps(current),
        }
      : null,
    items: withDays(items, timeZone, now),
    actions: current?.job.status === 'open' ? jobActions(current, customer.name, team, messages) : [],
  };
}

// The Job's next steps for where it stands, each done by the Assistant of its Role, as in the prototype.
function jobActions(detail: JobDetail, customerName: string, team: Team, messages: WhatsappMessage[]): Action[] {
  return stepActions(detail, customerName, messages).filter(
    ({ role }) => role === null || team.some((assistant) => assistant.role === role),
  );
}

function stepActions(detail: JobDetail, customerName: string, messages: WhatsappMessage[]): Action[] {
  const { quote, sentPix, service, executionBooked, recorded } = facts(detail);
  const sends = (originId: string) =>
    messages.filter((message) => message.direction === 'outbound' && message.originId === originId).length;
  const lastVisit = detail.visits.findLast(({ status }) => status !== 'cancelled');
  if (service) {
    if (sentPix && sentPix.status !== 'paid') {
      // The Customer already got it again (from here or from the reminder Routine).
      return [{ key: 'resend_charge', label: 'Reenviar o Pix', role: 'billing', done: sends(sentPix.id) > 1 }];
    }
    const returnBooked = detail.visits.some(
      ({ status, createdAt }) => status !== 'cancelled' && createdAt > service.createdAt,
    );
    return [
      { key: 'charge', label: 'Cobrar no Pix', role: 'billing', done: false },
      { key: 'return_visit', label: 'Agendar o retorno', role: 'scheduling', done: returnBooked },
    ];
  }
  // An approved Quote waits on the scheduling Assistant's question about booking the execution.
  if (quote?.status === 'approved' && !executionBooked) return [];
  if (quote?.status === 'sent') {
    const reminded = !!quote.followedUpAt || sends(quote.id) > 1;
    return [{ key: 'remind_quote', label: `Lembrar o ${firstName(customerName)}`, role: 'quotes', done: reminded }];
  }
  if (!lastVisit || (recorded && !executionBooked)) return [];
  const actions: Action[] = [
    { key: 'record', label: 'Contar como foi', role: null, visitId: lastVisit.id, done: false },
  ];
  if (!quote && !recorded) actions.push({ key: 'quote', label: 'Mandar orçamento', role: 'quotes', done: false });
  if (lastVisit.status !== 'confirmed') {
    const asked = lastVisit.confirmationRequestedFor?.getTime() === lastVisit.scheduledAt.getTime();
    actions.push({ key: 'confirm', label: 'Pedir confirmação', role: 'scheduling', done: asked });
  }
  actions.push({ key: 'reschedule', label: 'Remarcar', role: 'scheduling', done: false });
  return actions;
}

// An approved Quote with nothing booked to carry it out: the scheduling Assistant offers the first free times.
async function executionQuestion(
  detail: JobDetail,
  customerName: string,
  assistant: ReturnType<typeof speaker>,
  { timeZone, now }: { timeZone: string; now: Date },
): Promise<Item | undefined> {
  const { quote, executionBooked } = facts(detail);
  if (quote?.status !== 'approved' || executionBooked) return;
  const slots = await freeSlots(detail.job.professionalId, timeZone, now);
  return {
    type: 'question',
    id: `execution_question:${quote.id}`,
    at: quote.updatedAt,
    text: `Quer que eu marque a execução com o ${firstName(customerName)}? Estes horários estão livres:`,
    assistant,
    role: 'scheduling',
    options: [
      ...slots.map((slot, index) => ({
        label: formatSlot(slot, timeZone),
        ...(index === 0 && { hint: 'O primeiro horário livre' }),
      })),
      { label: 'Outro', hint: 'Escreva o dia e o horário', other: true },
    ],
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

type PixAccount = Awaited<ReturnType<typeof findPixAccount>>;

function jobItems(
  detail: JobDetail,
  customerName: string,
  { team, pixAccount, timeZone, now }: { team: Team; pixAccount: PixAccount; timeZone: string; now: Date },
): Item[] {
  const { job } = detail;
  const items: Item[] = [];
  const billing = team.find(({ role }) => role === 'billing');
  const first = firstName(customerName);

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
    // The billing Assistant answers the record: what the team can do now, or the amount still missing.
    if (billing) {
      items.push({
        type: 'assistant',
        id: `work_record_reply:${workRecord.id}`,
        at: workRecord.createdAt,
        text: service
          ? `Registrei o serviço do ${first}. Escolha o que a equipe faz agora:`
          : `Registrei a visita do ${first}. Se já fez o serviço, quanto ficou? Me diga aqui embaixo.`,
        assistant: speaker(billing),
      });
    }
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
      chargeId: charge.id,
      amount: formatMoney(charge.amountCents),
      detail: `Pix para ${customerName} · enviado no WhatsApp`,
      status:
        charge.status === 'paid' && charge.paidAt
          ? { label: `Pago às ${localTime(charge.paidAt, timeZone)}`, tone: 'ok' }
          : { label: 'Aguardando pagamento', tone: 'none' },
      // "Mostrar QR Code" lets the Customer pay on the spot.
      pixCode: pixAccount && chargePixCode(charge, pixAccount),
    });
    // Only the Professional knows whether the Pix arrived; the answer goes to the billing Assistant like a message.
    if (charge.status === 'awaiting_confirmation' && billing) {
      items.push({
        type: 'question',
        id: `paid_question:${charge.id}`,
        at: charge.updatedAt,
        text: `${first} disse que já pagou. O dinheiro caiu?`,
        assistant: speaker(billing),
        role: 'billing',
        options: [{ label: 'Recebi' }, { label: 'Não caiu' }],
      });
    }
  }

  for (const charge of detail.charges) {
    if (charge.status !== 'paid' || !charge.paidAt) continue;
    const text = `Pagamento recebido: ${formatMoney(charge.amountCents)}`;
    items.push({ type: 'line', id: `paid:${charge.id}`, at: charge.paidAt, text });
  }
  if (job.status === 'done' && job.closedAt) {
    items.push({ type: 'line', id: `job_done:${job.id}`, at: job.closedAt, text: 'Atendimento concluído' });
  }

  const start = Math.min(job.openedAt.getTime(), ...items.map(({ at }) => at.getTime()));
  return [{ type: 'job_start', id: `job_start:${job.id}`, at: new Date(start), title: job.title }, ...items];
}

// The WhatsApp exchanged with the Customer; what belongs to an earlier Job stays inside its card.
function whatsappItems(
  customer: Customer,
  messages: WhatsappMessage[],
  details: JobDetail[],
  current: JobDetail | undefined,
) {
  // The Customer's records are this Professional's, so a message about one of them is this thread's.
  const jobOf = new Map<string, string>();
  for (const { job, visits, quotes, charges } of details) {
    for (const { id } of [...visits, ...quotes, ...charges]) jobOf.set(id, job.id);
  }
  const first = firstName(customer.name);
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
async function teamItems(
  professionalId: string,
  customerId: string,
  team: Team,
  details: JobDetail[],
  current?: JobDetail,
) {
  const earlier = new Set(details.filter((detail) => detail !== current).map(({ job }) => job.id));
  const items: Item[] = [];
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

// What the Assistants' Routines did for this Customer, in time order whatever the Job.
async function noticeItems(professionalId: string, customerId: string) {
  const notices = await db
    .select({ id: assistantNotices.id, text: assistantNotices.text, createdAt: assistantNotices.createdAt })
    .from(assistantNotices)
    .innerJoin(assistants, eq(assistants.id, assistantNotices.assistantId))
    .where(
      and(
        eq(assistantNotices.customerId, customerId),
        isNull(assistantNotices.suggestion),
        eq(assistants.professionalId, professionalId),
      ),
    );
  return notices.map(({ id, text, createdAt }): Item => ({ type: 'notice', id: `notice:${id}`, at: createdAt, text }));
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
