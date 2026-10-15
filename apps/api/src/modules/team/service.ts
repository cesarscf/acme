import { assistants, db } from '@acme/db';
import { and, asc, eq } from 'drizzle-orm';
import { briefingScripts } from '../briefing/scripts';
import { type AssistantRole, catalogEntry } from './catalog';

export async function listTeam(professionalId: string) {
  const rows = await db
    .select({
      id: assistants.id,
      role: assistants.role,
      name: assistants.name,
      playbookStatus: assistants.playbookStatus,
    })
    .from(assistants)
    .where(eq(assistants.professionalId, professionalId))
    .orderBy(asc(assistants.createdAt), asc(assistants.role));
  return rows.map((assistant) => {
    const { title, tagline, mascot } = catalogEntry(assistant.role);
    return { ...assistant, title, tagline, mascot, hasBriefing: assistant.role in briefingScripts };
  });
}

export async function chooseRoles(professionalId: string, roles: AssistantRole[]) {
  await db
    .insert(assistants)
    .values(roles.map((role) => ({ professionalId, role, name: catalogEntry(role).name })))
    .onConflictDoNothing({ target: [assistants.professionalId, assistants.role] });
}

export async function renameAssistant(professionalId: string, id: string, name: string) {
  const renamed = await db
    .update(assistants)
    .set({ name: name.trim() })
    .where(and(eq(assistants.id, id), eq(assistants.professionalId, professionalId)))
    .returning({ id: assistants.id });
  return renamed.length > 0;
}
