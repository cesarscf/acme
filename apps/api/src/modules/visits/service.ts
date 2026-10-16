import { customers, db, professionals, visits } from '@acme/db';
import { and, asc, eq, getTableColumns, gte, lt, ne, type SQL, sql } from 'drizzle-orm';
import { addNotice } from '../conversations/notices';
import { openJob } from '../jobs/service';
import { defineTemplate, ensureTemplate, onButtonClick, sendMessage } from '../whatsapp/service';
import { formatLocalDateTime, nextDay, toInstant } from './time';

type VisitTiming = { scheduledAt: Date; durationMinutes: number };
export type VisitWithCustomer = Awaited<ReturnType<typeof selectVisits>>[number];

const visitConfirmationTemplate = defineTemplate({
  name: 'visit_confirmation',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Olá, {{1}}! Sua visita com {{2}} está marcada para {{3}}. Podemos confirmar?',
      example: { body_text: [['Ana', 'Carlos Elétrica', 'quinta-feira, 16/10, às 14:00']] },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'QUICK_REPLY', text: 'Remarcar' },
      ],
    },
  ],
});

// The payload carries the time the message asked about, so a tap on a message older than a reschedule is caught.
const buttonActions = ['confirm', 'reschedule'] as const;

export function ensureVisitConfirmationTemplate() {
  return ensureTemplate(env('META_PLATFORM_WABA_ID'), visitConfirmationTemplate);
}

export async function findVisit(professionalId: string, id: string) {
  const [visit] = await selectVisits(and(eq(visits.id, id), eq(visits.professionalId, professionalId)));
  return visit;
}

export function listVisits(professionalId: string, timeZone: string, from: string, to: string) {
  const start = toInstant(from, '00:00', timeZone);
  const end = toInstant(nextDay(to), '00:00', timeZone);
  return selectVisits(
    and(
      eq(visits.professionalId, professionalId),
      ne(visits.status, 'cancelled'),
      gte(visits.scheduledAt, start),
      lt(visits.scheduledAt, end),
    ),
  );
}

// A Visit that ends when another starts does not conflict with it.
export function findConflicts(
  professionalId: string,
  { scheduledAt, durationMinutes }: VisitTiming,
  exceptId?: string,
) {
  const end = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  return selectVisits(
    and(
      eq(visits.professionalId, professionalId),
      ne(visits.status, 'cancelled'),
      exceptId ? ne(visits.id, exceptId) : undefined,
      lt(visits.scheduledAt, end),
      sql`${visits.scheduledAt} + make_interval(mins => ${visits.durationMinutes}) > ${scheduledAt.toISOString()}`,
    ),
  );
}

function selectVisits(where: SQL | undefined) {
  return db
    .select({
      ...getTableColumns(visits),
      customer: { id: customers.id, name: customers.name, phoneNumber: customers.phoneNumber },
    })
    .from(visits)
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .where(where)
    .orderBy(asc(visits.scheduledAt));
}

// A Visit for a Customer without an open Job opens one, titled after what was asked.
export async function createVisit(professionalId: string, customerId: string, timing: VisitTiming, title = 'Visita') {
  const jobId = await openJob(professionalId, customerId, title);
  const [visit] = await db
    .insert(visits)
    .values({ professionalId, customerId, jobId, ...timing })
    .returning();
  return visit!;
}

// A moved Visit needs the Customer's confirmation again.
export async function rescheduleVisit(id: string, scheduledAt: Date) {
  await db.update(visits).set({ scheduledAt, status: 'scheduled' }).where(eq(visits.id, id));
}

export async function cancelVisit(id: string) {
  await db.update(visits).set({ status: 'cancelled' }).where(eq(visits.id, id));
}

export async function sendVisitConfirmation(
  visit: VisitWithCustomer,
  professional: { name: string; timezone: string },
) {
  await sendConfirmationTemplate(visit, professional);
  await db.update(visits).set({ confirmationRequestedFor: visit.scheduledAt }).where(eq(visits.id, visit.id));
}

async function sendConfirmationTemplate(visit: VisitWithCustomer, professional: { name: string; timezone: string }) {
  // ADR 0003: the Customer channel is the Professional's own number, connected in ticket 18; M1 sends from the platform's.
  await sendMessage({
    from: env('META_PLATFORM_PHONE_NUMBER_ID'),
    to: visit.customer.phoneNumber,
    message: {
      type: 'template',
      template: {
        name: visitConfirmationTemplate.name,
        language: { code: visitConfirmationTemplate.language },
        components: [
          {
            type: 'body',
            parameters: [
              visit.customer.name,
              professional.name,
              formatLocalDateTime(visit.scheduledAt, professional.timezone),
            ].map((text) => ({ type: 'text' as const, text })),
          },
          ...buttonActions.map((action, index) => ({
            type: 'button' as const,
            sub_type: 'quick_reply' as const,
            index: String(index),
            parameters: [{ type: 'payload' as const, payload: `${action}:${visit.scheduledAt.toISOString()}` }],
          })),
        ],
      },
    },
    origin: { type: 'visit', id: visit.id },
  });
}

export async function requestDueVisitConfirmations(
  professional: { id: string; name: string; timezone: string },
  date: string,
) {
  const due = await listVisits(professional.id, professional.timezone, date, date);
  for (const visit of due) {
    if (
      visit.status !== 'scheduled' ||
      visit.scheduledAt.getTime() <= Date.now() ||
      visit.confirmationRequestedFor?.getTime() === visit.scheduledAt.getTime()
    ) {
      continue;
    }
    // Claimed before sending, so a retry overlapping the next run cannot ask the same Customer twice.
    const [claimed] = await db
      .update(visits)
      .set({ confirmationRequestedFor: visit.scheduledAt })
      .where(
        and(
          eq(visits.id, visit.id),
          eq(visits.status, 'scheduled'),
          eq(visits.scheduledAt, visit.scheduledAt),
          sql`${visits.confirmationRequestedFor} is distinct from ${visits.scheduledAt}`,
        ),
      )
      .returning({ id: visits.id });
    if (!claimed) continue;
    try {
      await sendConfirmationTemplate(visit, professional);
    } catch (error) {
      await db
        .update(visits)
        .set({ confirmationRequestedFor: visit.confirmationRequestedFor })
        .where(eq(visits.id, visit.id));
      throw error;
    }
    const when = formatLocalDateTime(visit.scheduledAt, professional.timezone);
    await db.transaction((tx) =>
      addNotice(
        tx,
        professional.id,
        'scheduling',
        `Rotina: pedi para ${visit.customer.name} confirmar a visita de ${when}.`,
      ),
    );
  }
}

onButtonClick('visit', async ({ originId, button, tx }) => {
  const [visit] = await tx
    .select({
      id: visits.id,
      status: visits.status,
      scheduledAt: visits.scheduledAt,
      professionalId: visits.professionalId,
      timezone: professionals.timezone,
      customerName: customers.name,
    })
    .from(visits)
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .innerJoin(professionals, eq(professionals.id, visits.professionalId))
    .where(eq(visits.id, originId))
    // Two quick taps (Confirmar, then Remarcar) are answered one after the other, so the second sees the first.
    .for('update', { of: visits });
  const separator = button.payload.indexOf(':');
  const action = button.payload.slice(0, separator);
  const askedFor = new Date(button.payload.slice(separator + 1));
  if (!visit || separator < 0 || Number.isNaN(askedFor.getTime())) return;
  const when = formatLocalDateTime(visit.scheduledAt, visit.timezone);

  let text: string;
  if (visit.status === 'cancelled') {
    text = `${visit.customerName} tocou em ${button.text} na visita de ${when}, mas essa visita está cancelada.`;
  } else if (askedFor.getTime() !== visit.scheduledAt.getTime()) {
    const asked = formatLocalDateTime(askedFor, visit.timezone);
    text = `${visit.customerName} tocou em ${button.text} na mensagem da visita de ${asked}, mas ela mudou para ${when}. Nada mudou na visita.`;
  } else if (action === 'confirm') {
    await tx.update(visits).set({ status: 'confirmed' }).where(eq(visits.id, visit.id));
    text = `${visit.customerName} confirmou a visita de ${when}.`;
  } else if (action === 'reschedule') {
    await tx.update(visits).set({ status: 'reschedule_requested' }).where(eq(visits.id, visit.id));
    text = `${visit.customerName} pediu para remarcar a visita de ${when}.`;
  } else return;

  await addNotice(tx, visit.professionalId, 'scheduling', text);
});

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
