import { customers, db } from '@acme/db';
import { and, asc, eq, ilike, or } from 'drizzle-orm';

export type Customer = typeof customers.$inferSelect;

export function toPhoneNumber(typed: string) {
  const digits = typed.replace(/\D/g, '');
  const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length === 10 || national.length === 11) return `55${national}`;
}

export function formatPhoneNumber(phoneNumber: string) {
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(phoneNumber);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phoneNumber;
}

export function findCustomers(professionalId: string, query: string) {
  const digits = query.replace(/\D/g, '');
  return db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.professionalId, professionalId),
        or(
          ilike(customers.name, `%${escapeLike(query.trim())}%`),
          digits.length >= 4 ? ilike(customers.phoneNumber, `%${digits}%`) : undefined,
        ),
      ),
    )
    .orderBy(asc(customers.name))
    .limit(10);
}

export function findCustomer(professionalId: string, id: string) {
  return db.query.customers.findFirst({
    where: and(eq(customers.id, id), eq(customers.professionalId, professionalId)),
  });
}

// The phone number is the identity: a second Customer with the same number is the one that exists.
export async function createCustomer(
  professionalId: string,
  { name, phoneNumber }: { name: string; phoneNumber: string },
) {
  const [created] = await db
    .insert(customers)
    .values({ professionalId, name: name.trim(), phoneNumber })
    .onConflictDoNothing({ target: [customers.professionalId, customers.phoneNumber] })
    .returning();
  if (created) return { customer: created, created: true };
  const existing = await db.query.customers.findFirst({
    where: and(eq(customers.professionalId, professionalId), eq(customers.phoneNumber, phoneNumber)),
  });
  return { customer: existing!, created: false };
}

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
