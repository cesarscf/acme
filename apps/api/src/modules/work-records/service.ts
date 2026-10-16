import { assistants, audioUsages, charges, customers, db, professionals, workRecords } from '@acme/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { paymentMethods } from '../charges/briefing';
import { followAmount } from '../charges/service';
import { createCustomer, findCustomer, toPhoneNumber } from '../customers/service';
import { concludeJob, openJob } from '../jobs/service';
import { addDays, formatLocalDateTime, localDate } from '../time/time';
import { findVisit, listVisits } from '../visits/service';
import { type Extraction, extractWorkRecord } from './extract';

export type PaymentMethod = (typeof workRecords.$inferInsert)['paymentMethod'];
export type PaymentMethods = { accepted: PaymentMethod[]; default: PaymentMethod };
type WorkRecord = typeof workRecords.$inferSelect;

// Before the billing Assistant's Briefing there is no Playbook to read, so both PaymentMethods are offered with Pix marked.
const fallbackPaymentMethods: PaymentMethods = { accepted: ['pix', 'cash'], default: 'pix' };
const recentVisitDays = 7;
const customerOptionCount = 3;

async function findProfessional(id: string) {
  const [professional] = await db
    .select({ id: professionals.id, name: professionals.name, timezone: professionals.timezone })
    .from(professionals)
    .where(eq(professionals.id, id));
  return professional!;
}

// The billing Assistant owns the PaymentMethods; the WorkRecord's usage is counted for it too.
export async function findBillingAssistant(professionalId: string) {
  const [billingAssistant] = await db
    .select({ id: assistants.id, playbook: assistants.playbook })
    .from(assistants)
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, 'billing')));
  return billingAssistant;
}

async function findPaymentMethods(professionalId: string): Promise<PaymentMethods> {
  const billingAssistant = await findBillingAssistant(professionalId);
  const parsed = paymentMethods.safeParse(
    (billingAssistant?.playbook as Record<string, unknown> | undefined)?.paymentMethods,
  );
  return parsed.success ? parsed.data : fallbackPaymentMethods;
}

async function listRecentVisits(professional: { id: string; timezone: string }) {
  const today = localDate(new Date(), professional.timezone);
  const recent = await listVisits(professional.id, professional.timezone, addDays(today, -recentVisitDays), today);
  return recent.reverse().map((visit) => ({
    id: visit.id,
    customerId: visit.customer.id,
    customerName: visit.customer.name,
    when: formatLocalDateTime(visit.scheduledAt, professional.timezone),
  }));
}

function listCustomerNames(professionalId: string) {
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.professionalId, professionalId))
    .orderBy(asc(customers.name))
    .limit(300);
}

export async function recordAudioUsage(
  professionalId: string,
  assistantId: string | null,
  { seconds, model }: { seconds: number; model: string },
) {
  await db.insert(audioUsages).values({ professionalId, assistantId, seconds, model });
}

async function extract(professionalId: string, transcript: string) {
  const billingAssistant = await findBillingAssistant(professionalId);
  const professional = await findProfessional(professionalId);
  return extractWorkRecord(
    {
      professionalId,
      assistantId: billingAssistant?.id ?? null,
      customers: await listCustomerNames(professionalId),
      visits: await listRecentVisits(professional),
      paymentMethods: await findPaymentMethods(professionalId),
    },
    transcript,
  );
}

// Saved only once the Professional said where it goes: a Visit, a Customer, or a new Customer's name and WhatsApp.
// The Visit comes only from that choice, never from the audio, so a rejected Visit is not used.
export async function createWorkRecord(
  professionalId: string,
  transcript: string,
  chosen: { visitId?: string; customerId?: string; customer?: string },
) {
  const visit = chosen.visitId ? await findVisit(professionalId, chosen.visitId) : undefined;
  if (chosen.visitId && !visit) return { refused: 'visit_not_found' as const };
  if (chosen.customerId && !(await findCustomer(professionalId, chosen.customerId))) {
    return { refused: 'customer_not_found' as const };
  }
  const text = [transcript.trim(), chosen.customer?.trim()].filter(Boolean).join('\n');
  const extraction = await extract(professionalId, text);
  const { cashReceived, paymentMethod, newCustomer, customerId: _, visitId: __, ...fields } = extraction;
  const resolved = visit
    ? { customerId: visit.customer.id, newCustomerName: null }
    : chosen.customerId
      ? { customerId: chosen.customerId, newCustomerName: null }
      : await resolveCustomer(professionalId, extraction);
  const { customerId } = resolved;
  if (!customerId) return { refused: 'customer_unknown' as const, newCustomerName: resolved.newCustomerName };
  const [workRecord] = await db
    .insert(workRecords)
    .values({
      ...fields,
      visitId: visit?.id ?? null,
      customerId,
      jobId: visit ? visit.jobId : await openJob(professionalId, customerId, fields.title ?? 'Serviço'),
      professionalId,
      paymentMethod: paymentMethod ?? (await findPaymentMethods(professionalId)).default,
      cashReceived: paymentMethod === 'cash' ? cashReceived : null,
      transcript: text,
    })
    .returning();
  await settleCash(workRecord!);
  return { workRecord: await viewWorkRecord(workRecord!) };
}

// A message completes or corrects the account: Claude reads it all again.
// A WorkRecord with a Customer keeps it; without one, the message can name who it is.
export async function addMessage(professionalId: string, id: string, text: string) {
  const current = await findWorkRecord(professionalId, id);
  if (!current) return;
  const transcript = `${current.transcript}\n${text.trim()}`;
  const extraction = await extract(professionalId, transcript);
  const resolved = current.customerId
    ? { customerId: current.customerId, newCustomerName: null }
    : await resolveCustomer(professionalId, extraction);
  const customerId = resolved.customerId ?? current.customerId;
  const visitId = current.visitId ?? extraction.visitId;
  const merged = merge(current, extraction);
  const [workRecord] = await db
    .update(workRecords)
    .set({
      ...merged,
      customerId,
      visitId,
      jobId:
        current.jobId && customerId === current.customerId
          ? current.jobId
          : await jobFor(professionalId, { customerId, visitId, title: merged.title }),
      transcript,
    })
    .where(eq(workRecords.id, id))
    .returning();
  if (workRecord!.amountCents && workRecord!.amountCents !== current.amountCents)
    await followAmount(id, workRecord!.amountCents);
  await settleCash(workRecord!);
  // Not saved: the thread asks for the WhatsApp right after, and the next message carries both again.
  const newCustomerName = customerId ? null : resolved.newCustomerName;
  return { ...(await viewWorkRecord(workRecord!)), newCustomerName };
}

// A WorkRecord goes into its Visit's Job, or into the Customer's open Job; without a Customer it waits for one.
async function jobFor(
  professionalId: string,
  { customerId, visitId, title }: { customerId: string | null; visitId: string | null; title: string | null },
) {
  if (!customerId) return null;
  const visit = visitId ? await findVisit(professionalId, visitId) : undefined;
  if (visit?.customer.id === customerId) return visit.jobId;
  return openJob(professionalId, customerId, title ?? 'Serviço');
}

// A Customer named in the thread is created there once the WhatsApp is known, as the Assistants do in their conversations.
async function resolveCustomer(professionalId: string, { customerId, newCustomer }: Extraction) {
  if (customerId || !newCustomer) return { customerId, newCustomerName: null };
  const phoneNumber = newCustomer.phoneNumber && toPhoneNumber(newCustomer.phoneNumber);
  if (!phoneNumber) return { customerId: null, newCustomerName: newCustomer.name };
  const { customer } = await createCustomer(professionalId, { name: newCustomer.name, phoneNumber });
  return { customerId: customer.id, newCustomerName: null };
}

function merge(current: WorkRecord, extraction: Extraction) {
  const paymentMethod = extraction.paymentMethod ?? current.paymentMethod;
  return {
    title: extraction.title ?? current.title,
    description: extraction.description ?? current.description,
    materials: extraction.materials ?? current.materials,
    amountCents: extraction.amountCents ?? current.amountCents,
    paymentMethod,
    cashReceived: paymentMethod === 'cash' ? (extraction.cashReceived ?? current.cashReceived) : null,
  };
}

// Cash already received becomes a paid Charge once the Customer and the amount are known; nothing goes to the Customer.
// A Pix Charge not yet paid is cancelled, so it stops being reminded.
async function settleCash(workRecord: WorkRecord) {
  const { id, professionalId, customerId, jobId, amountCents, paymentMethod, cashReceived } = workRecord;
  if (paymentMethod !== 'cash' || !cashReceived || !customerId || !amountCents) return;
  await db.transaction(async (tx) => {
    const [pixCharge] = await tx
      .select({ status: charges.status })
      .from(charges)
      .where(and(eq(charges.workRecordId, id), eq(charges.paymentMethod, 'pix')))
      .for('update');
    if (pixCharge?.status === 'paid') return;
    await tx
      .update(charges)
      .set({ status: 'cancelled' })
      .where(and(eq(charges.workRecordId, id), eq(charges.paymentMethod, 'pix')));
    await tx
      .insert(charges)
      .values({
        professionalId,
        workRecordId: id,
        customerId,
        amountCents,
        paymentMethod: 'cash',
        status: 'paid',
        paidAt: new Date(),
      })
      .onConflictDoNothing({ target: [charges.workRecordId, charges.paymentMethod] });
    if (jobId) await concludeJob(jobId, tx);
  });
}

function findWorkRecord(professionalId: string, id: string) {
  return db.query.workRecords.findFirst({
    where: and(eq(workRecords.id, id), eq(workRecords.professionalId, professionalId)),
  });
}

async function viewWorkRecord(workRecord: WorkRecord) {
  const customer = workRecord.customerId
    ? await findCustomer(workRecord.professionalId, workRecord.customerId)
    : undefined;
  const paidCharge = await db.query.charges.findFirst({
    where: and(eq(charges.workRecordId, workRecord.id), eq(charges.status, 'paid')),
  });
  return {
    id: workRecord.id,
    createdAt: workRecord.createdAt,
    customer: customer ? { id: customer.id, name: customer.name } : null,
    title: workRecord.title,
    description: workRecord.description,
    materials: workRecord.materials,
    amountCents: workRecord.amountCents,
    paymentMethod: workRecord.paymentMethod,
    paid: !!paidCharge,
    transcript: workRecord.transcript,
  };
}

// Who an account without a Visit is most likely for: Customers with a recent Visit, then the newest Customers.
export async function listCustomerOptions(professionalId: string) {
  const professional = await findProfessional(professionalId);
  const visited = (await listRecentVisits(professional)).map(({ customerId, customerName }) => ({
    id: customerId,
    name: customerName,
  }));
  const newest = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.professionalId, professionalId))
    .orderBy(desc(customers.createdAt))
    .limit(customerOptionCount);
  const unique = new Map([...visited, ...newest].map((customer) => [customer.id, customer]));
  return [...unique.values()].slice(0, customerOptionCount);
}
