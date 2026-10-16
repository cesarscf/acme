import { assistantMessages, assistantNotices, assistants, db } from '@acme/db';
import { type AnyColumn, and, asc, desc, eq, sql } from 'drizzle-orm';
import { briefingScripts } from '../briefing/scripts';
import { type AssistantRole, catalogEntry } from './catalog';

type LastMessage = { from: 'professional' | 'assistant' | 'notice'; text: string; at: Date };

export async function listTeam(professionalId: string) {
  const rows = await db
    .select({
      id: assistants.id,
      role: assistants.role,
      name: assistants.name,
      playbookStatus: assistants.playbookStatus,
      createdAt: assistants.createdAt,
    })
    .from(assistants)
    .where(eq(assistants.professionalId, professionalId))
    .orderBy(asc(assistants.createdAt), asc(assistants.role));
  const lastMessages = await loadLastMessages(professionalId);
  return rows.map((assistant) => {
    const { title, tagline, mascot } = catalogEntry(assistant.role);
    return {
      ...assistant,
      title,
      tagline,
      mascot,
      hasBriefing: assistant.role in briefingScripts,
      lastMessage: lastMessages.get(assistant.id) ?? null,
    };
  });
}

// The home list shows what was said last in each conversation: a message with text or a notice, whichever is newer.
async function loadLastMessages(professionalId: string) {
  const messages = await db
    .selectDistinctOn([assistantMessages.assistantId], {
      assistantId: assistantMessages.assistantId,
      role: assistantMessages.role,
      content: assistantMessages.content,
      at: assistantMessages.createdAt,
      micros: inMicroseconds(assistantMessages.createdAt),
    })
    .from(assistantMessages)
    .innerJoin(assistants, eq(assistants.id, assistantMessages.assistantId))
    .where(
      and(
        eq(assistants.professionalId, professionalId),
        sql`${assistantMessages.content} @> '[{"type":"text"}]'::jsonb`,
      ),
    )
    .orderBy(assistantMessages.assistantId, desc(assistantMessages.createdAt));
  const notices = await db
    .selectDistinctOn([assistantNotices.assistantId], {
      assistantId: assistantNotices.assistantId,
      text: assistantNotices.text,
      at: assistantNotices.createdAt,
      micros: inMicroseconds(assistantNotices.createdAt),
    })
    .from(assistantNotices)
    .innerJoin(assistants, eq(assistants.id, assistantNotices.assistantId))
    .where(eq(assistants.professionalId, professionalId))
    .orderBy(assistantNotices.assistantId, desc(assistantNotices.createdAt));

  const last = new Map<string, LastMessage>();
  const lastMicros = new Map<string, bigint>();
  for (const { assistantId, role, content, at, micros } of messages) {
    const text = (content as { type: string; text?: string }[])
      .flatMap((block) => (block.type === 'text' && block.text ? [block.text] : []))
      .join(' ')
      .trim();
    if (!text) continue;
    last.set(assistantId, { from: role === 'user' ? 'professional' : 'assistant', text, at });
    lastMicros.set(assistantId, BigInt(micros));
  }
  for (const { assistantId, text, at, micros } of notices) {
    const messageMicros = lastMicros.get(assistantId);
    if (messageMicros === undefined || messageMicros < BigInt(micros))
      last.set(assistantId, { from: 'notice', text, at });
  }
  return last;
}

// A JS Date keeps only milliseconds, so a message and a notice written in the same one would tie.
function inMicroseconds(column: AnyColumn) {
  return sql<string>`(extract(epoch from ${column}) * 1000000)::bigint`;
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
