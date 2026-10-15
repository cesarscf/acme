import { db, users } from '@acme/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { ProfessionalsModel } from './model';

type Changes = (typeof ProfessionalsModel)['professionals.Changes']['static'];

export async function getProfessional(id: string) {
  const [professional] = await db
    .select({
      id: users.id,
      name: users.name,
      phoneNumber: users.phoneNumber,
      timezone: users.timezone,
      trades: users.trades,
      workStyle: users.workStyle,
      aiConsentedAt: users.aiConsentedAt,
    })
    .from(users)
    .where(eq(users.id, id));
  return professional!;
}

export async function updateProfessional(id: string, { name, ...changes }: Changes) {
  await db
    .update(users)
    .set({ ...changes, name: name?.trim() })
    .where(eq(users.id, id));
}

export async function consentToAi(id: string) {
  await db
    .update(users)
    .set({ aiConsentedAt: new Date() })
    .where(and(eq(users.id, id), isNull(users.aiConsentedAt)));
}
