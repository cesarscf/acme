import { db, professionals } from '@acme/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { ProfessionalsModel } from './model';

type Changes = (typeof ProfessionalsModel)['professionals.Changes']['static'];

export async function getProfessional(id: string) {
  const [professional] = await db
    .select({
      id: professionals.id,
      name: professionals.name,
      phoneNumber: professionals.phoneNumber,
      timezone: professionals.timezone,
      trades: professionals.trades,
      workStyle: professionals.workStyle,
      aiConsentedAt: professionals.aiConsentedAt,
    })
    .from(professionals)
    .where(eq(professionals.id, id));
  return professional!;
}

export async function updateProfessional(id: string, { name, ...changes }: Changes) {
  await db
    .update(professionals)
    .set({ ...changes, name: name?.trim() })
    .where(eq(professionals.id, id));
}

export async function consentToAi(id: string) {
  await db
    .update(professionals)
    .set({ aiConsentedAt: new Date() })
    .where(and(eq(professionals.id, id), isNull(professionals.aiConsentedAt)));
}
