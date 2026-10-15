import { assistants, audioUsages, charges, customers, db, professionals, visits, workRecords } from '@acme/db';
import { and, asc, eq } from 'drizzle-orm';
import { paymentMethods } from '../briefing/scripts';
import { findCustomer } from '../customers/service';
import { listVisits } from '../visits/service';
import { addDays, formatLocalDateTime, localDate } from '../visits/time';

export type PaymentMethod = (typeof workRecords.$inferInsert)['paymentMethod'];
export type PaymentMethods = { accepted: PaymentMethod[]; default: PaymentMethod };
export type NewWorkRecord = {
  customerId: string;
  visitId: string | null;
  description: string;
  materials: string | null;
  amountCents: number;
  paymentMethod: PaymentMethod;
  received?: boolean;
};

// Before the billing Assistant's Briefing there is no Playbook to read, so both PaymentMethods are offered with Pix marked.
const fallbackPaymentMethods: PaymentMethods = { accepted: ['pix', 'cash'], default: 'pix' };
const recentVisitDays = 7;

export async function findProfessional(id: string) {
  const [professional] = await db
    .select({ id: professionals.id, timezone: professionals.timezone })
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

export async function findPaymentMethods(professionalId: string): Promise<PaymentMethods> {
  const billingAssistant = await findBillingAssistant(professionalId);
  const parsed = paymentMethods.safeParse(
    (billingAssistant?.playbook as Record<string, unknown> | undefined)?.paymentMethods,
  );
  return parsed.success ? parsed.data : fallbackPaymentMethods;
}

// The Visits a WorkRecord can be about: the last week up to the end of today.
export async function listRecentVisits(professional: { id: string; timezone: string }) {
  const today = localDate(new Date(), professional.timezone);
  const recent = await listVisits(professional.id, professional.timezone, addDays(today, -recentVisitDays), today);
  return recent.reverse().map((visit) => ({
    id: visit.id,
    customerId: visit.customer.id,
    customerName: visit.customer.name,
    when: formatLocalDateTime(visit.scheduledAt, professional.timezone),
  }));
}

export async function getWorkRecordForm(professionalId: string) {
  const professional = await findProfessional(professionalId);
  return {
    paymentMethods: await findPaymentMethods(professionalId),
    visits: await listRecentVisits(professional),
  };
}

export function listCustomerNames(professionalId: string) {
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

type Refused = { refused: 'customer_not_found' | 'visit_not_found' | 'payment_method_not_accepted' };

// Cash already received becomes a paid Charge right away; nothing goes to the Customer.
export async function createWorkRecord(
  professionalId: string,
  { received, ...record }: NewWorkRecord,
): Promise<Refused | { workRecord: typeof workRecords.$inferSelect; charge: typeof charges.$inferSelect | null }> {
  if (!(await findCustomer(professionalId, record.customerId))) return { refused: 'customer_not_found' };
  if (record.visitId) {
    const visit = await db.query.visits.findFirst({
      where: and(
        eq(visits.id, record.visitId),
        eq(visits.professionalId, professionalId),
        eq(visits.customerId, record.customerId),
      ),
    });
    if (!visit) return { refused: 'visit_not_found' };
  }
  const { accepted } = await findPaymentMethods(professionalId);
  if (!accepted.includes(record.paymentMethod)) return { refused: 'payment_method_not_accepted' };

  return db.transaction(async (tx) => {
    const [workRecord] = await tx
      .insert(workRecords)
      .values({
        ...record,
        professionalId,
        description: record.description.trim(),
        materials: record.materials?.trim() || null,
      })
      .returning();
    if (record.paymentMethod !== 'cash' || !received) return { workRecord: workRecord!, charge: null };
    const [charge] = await tx
      .insert(charges)
      .values({
        professionalId,
        workRecordId: workRecord!.id,
        customerId: workRecord!.customerId,
        amountCents: workRecord!.amountCents,
        paymentMethod: 'cash',
        status: 'paid',
        paidAt: new Date(),
      })
      .returning();
    return { workRecord: workRecord!, charge: charge! };
  });
}
