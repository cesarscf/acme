import { db, professionals } from '@acme/db';
import { eq } from 'drizzle-orm';
import { formatWholeMoney } from '../charges/service';
import type { ConfirmationCard } from '../conversations/tools';
import {
  hasEnded,
  type JobDetail,
  jobStatus,
  lastActivity,
  listJobs,
  type Pill,
  relativeDay,
  waitingFor,
} from '../jobs/progress';
import { daysAgo, localTime, shortDay } from '../time/time';
import { findCustomers, formatPhoneNumber } from './service';

type Row = { id: string; name: string; when: string; detail: string; status: Pill | null };

// The Customers tab: who has a Visit today, who the Professional waits on, and everyone else.
export async function listCustomerSections(professionalId: string, query = '', now = new Date()) {
  const [professional] = await db
    .select({ timezone: professionals.timezone })
    .from(professionals)
    .where(eq(professionals.id, professionalId));
  const timeZone = professional!.timezone;
  const found = await findCustomers(professionalId, query, 500);
  const details = await listJobs(
    professionalId,
    found.map(({ id }) => id),
  );

  const today: (Row & { at: number })[] = [];
  // The first Visit today of each Customer who has not confirmed yet, for "Pedir confirmação".
  const unconfirmed: { visitId: string; name: string; scheduledAt: Date }[] = [];
  const waiting: (Row & { at: number })[] = [];
  const upcoming: (Row & { at: number })[] = [];
  const recent: (Row & { at: number })[] = [];
  for (const customer of found) {
    const own = details.filter(({ job }) => job.customerId === customer.id);
    const base = { id: customer.id, name: customer.name };
    const live = own.flatMap((detail) =>
      detail.visits.filter(({ status }) => status !== 'cancelled').map((visit) => ({ detail, visit })),
    );

    const toAsk = live.find(
      ({ detail, visit }) =>
        daysAgo(visit.scheduledAt, timeZone, now) === 0 &&
        visit.status === 'scheduled' &&
        !hasEnded(visit, now) &&
        !detail.workRecords.some(({ visitId }) => visitId === visit.id),
    );
    if (toAsk) unconfirmed.push({ visitId: toAsk.visit.id, name: customer.name, scheduledAt: toAsk.visit.scheduledAt });
    const visitToday = live.find(({ visit }) => daysAgo(visit.scheduledAt, timeZone, now) === 0);
    if (visitToday) {
      const { detail, visit } = visitToday;
      today.push({
        ...base,
        at: visit.scheduledAt.getTime(),
        when: localTime(visit.scheduledAt, timeZone),
        detail: hasEnded(visit, now) ? `${detail.job.title} · feita` : detail.job.title,
        status: jobStatus(detail, visit, now),
      });
      continue;
    }

    const open = own.find(({ job }) => job.status === 'open');
    const missing = open && waitingFor(open, timeZone, now);
    if (open && missing) {
      const at = lastActivity(open);
      waiting.push({
        ...base,
        at: at.getTime(),
        when: relativeDay(at, timeZone, now),
        detail: missing,
        status: jobStatus(open, undefined, now),
      });
      continue;
    }

    const next = live.find(({ visit }) => visit.scheduledAt > now);
    if (next) {
      const { detail, visit } = next;
      upcoming.push({
        ...base,
        at: visit.scheduledAt.getTime(),
        when: shortDay(visit.scheduledAt, timeZone),
        detail: `Próxima: ${lowerFirst(detail.job.title)}, ${localTime(visit.scheduledAt, timeZone)}`,
        status: jobStatus(detail, visit, now),
      });
      continue;
    }

    const last = own.at(-1);
    const at = last ? lastActivity(last) : customer.createdAt;
    recent.push({
      ...base,
      at: at.getTime(),
      when: relativeDay(at, timeZone, now),
      detail: last ? describeJob(last) : formatPhoneNumber(customer.phoneNumber),
      status: last ? jobStatus(last, undefined, now) : null,
    });
  }

  const byTime = (a: { at: number }, b: { at: number }) => a.at - b.at;
  unconfirmed.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const sections = [
    {
      key: 'today' as const,
      title: 'HOJE',
      rows: today.sort(byTime),
      confirmation: unconfirmed.length ? confirmationOf(unconfirmed, timeZone) : null,
    },
    { key: 'waiting' as const, title: 'ESPERANDO O CLIENTE', rows: waiting.sort(byTime).reverse(), confirmation: null },
    // The next Visit first, the soonest on top; then the last activity, newest first.
    {
      key: 'recent' as const,
      title: 'RECENTES',
      rows: [...upcoming.sort(byTime), ...recent.sort(byTime).reverse()],
      confirmation: null,
    },
  ];
  return {
    sections: sections
      .filter(({ rows }) => rows.length)
      .map(({ rows, ...section }) => ({ ...section, rows: rows.map(({ at, ...row }) => row) })),
  };
}

// The card shown before asking everyone at once; the ids are the Visits it lists, so what is sent is what was shown.
function confirmationOf(unconfirmed: { visitId: string; name: string; scheduledAt: Date }[], timeZone: string) {
  const count = unconfirmed.length === 1 ? '1 cliente' : `${unconfirmed.length} clientes`;
  const card: ConfirmationCard = {
    title: 'Para confirmar: pedir a confirmação de hoje',
    subtitle: count,
    rows: unconfirmed.map(({ name, scheduledAt }) => ({ label: localTime(scheduledAt, timeZone), value: name })),
    notices: [
      'Nada é enviado agora.',
      'Depois que você confirmar, cada cliente recebe uma mensagem no WhatsApp com os botões Confirmar e Remarcar.',
    ],
    question: `Confirma: pedir a confirmação de ${count}?`,
  };
  return { visitIds: unconfirmed.map(({ visitId }) => visitId), card };
}

// "Instalação de split 9.000 BTU · R$ 1.900", the last Job of a Customer.
function describeJob({ job, workRecords, quotes }: JobDetail) {
  const amountCents =
    workRecords.findLast(({ amountCents }) => amountCents !== null)?.amountCents ?? quotes.at(-1)?.totalCents;
  return amountCents ? `${job.title} · ${formatWholeMoney(amountCents)}` : job.title;
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
