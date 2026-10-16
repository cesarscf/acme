import { assistantMessages, assistants, db, professionals } from '@acme/db';
import { and, eq } from 'drizzle-orm';
import { catalogEntry } from '../team/catalog';
import type { PromptContext } from './prompts';

export type Assistant = PromptContext & { id: string; professional: PromptContext['professional'] & { id: string } };

export async function findAssistant(professionalId: string, id: string): Promise<Assistant | undefined> {
  const [row] = await db
    .select({
      id: assistants.id,
      role: assistants.role,
      name: assistants.name,
      playbook: assistants.playbook,
      playbookStatus: assistants.playbookStatus,
      professional: { id: professionals.id, name: professionals.name, timezone: professionals.timezone },
    })
    .from(assistants)
    .innerJoin(professionals, eq(professionals.id, assistants.professionalId))
    .where(and(eq(assistants.id, id), eq(assistants.professionalId, professionalId)));
  return row;
}

export async function hasAiConsent(professionalId: string) {
  const [row] = await db
    .select({ aiConsentedAt: professionals.aiConsentedAt })
    .from(professionals)
    .where(eq(professionals.id, professionalId));
  return !!row?.aiConsentedAt;
}

export async function listThreadAssistants(professionalId: string, customerId: string) {
  const rows = await db
    .selectDistinct({ id: assistantMessages.assistantId })
    .from(assistantMessages)
    .innerJoin(assistants, eq(assistants.id, assistantMessages.assistantId))
    .where(and(eq(assistantMessages.customerId, customerId), eq(assistants.professionalId, professionalId)));
  const found = await Promise.all(rows.map(({ id }) => findAssistant(professionalId, id)));
  return found.filter((assistant) => !!assistant);
}

export function speaker({ id, name, role }: Pick<Assistant, 'id' | 'name' | 'role'>) {
  const { title, mascot } = catalogEntry(role);
  return { id, name, title, mascot };
}
