import { expect } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistantMessages, assistantNotices, assistants, db } from '@acme/db';
import type Anthropic from '@anthropic-ai/sdk';
import { asc, eq } from 'drizzle-orm';
import { signInNewProfessional } from '../auth/test-auth';
import { createCustomer } from '../customers/service';
import { chooseAssistant, inCustomerThread, runTeam } from '../customers/team-messages';
import { getCustomerThread } from '../customers/thread';
import type { AssistantRole } from '../team/catalog';
import { type Assistant, answerSuggestion, findAssistant, sendText, type TurnEvent } from './service';
import { api, newAssistant } from './test-tools';

type Block = Anthropic.Beta.BetaContentBlockParam;
export type ToolCall = { name: string; input: Record<string, unknown> };
export type Turn = { calls: ToolCall[]; reply: string; end: TurnEvent };

export async function scriptedAssistant(role: AssistantRole, playbook: Record<string, unknown> = {}) {
  const created = await newAssistant(role);
  await db.update(assistants).set({ playbook }).where(eq(assistants.id, created.id));
  return (await findAssistant(created.professional.id, created.id))!;
}

export async function scriptedTeam() {
  const { professional, headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling', 'quotes', 'billing'] }, { headers });
  return { professional: { id: professional.id } };
}

export function customerOf(
  { professional }: { professional: { id: string } },
  name: string,
  phoneNumber = randomPhoneNumber(),
) {
  return createCustomer(professional.id, { name, phoneNumber }).then(({ customer }) => customer);
}

function randomPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

export function notice(assistant: Assistant, text: string, extra: Partial<typeof assistantNotices.$inferInsert> = {}) {
  return db
    .insert(assistantNotices)
    .values({ assistantId: assistant.id, text, ...extra })
    .returning()
    .then(([row]) => row!);
}

export function say(assistant: Assistant, text: string) {
  return turn(assistant, (emit) => sendText(assistant, text, emit));
}

// The Professional writes in the Customer's thread; the team picks who answers.
// role is who the message went to; calls and replies cover every teammate that answered after them.
export async function sayInThread(professionalId: string, customerId: string, text: string) {
  const thread = (await getCustomerThread(professionalId, customerId))!;
  const chosen = (await chooseAssistant(professionalId, thread, text))!;
  const first = await inCustomerThread(chosen, thread);
  const before = (await threadMessagesOf(customerId)).length;
  const end = await runTeam(
    first,
    (assistant, emit) => sendText(assistant, text, emit),
    () => {},
  );
  const said = (await threadMessagesOf(customerId)).slice(before).filter(({ role }) => role === 'assistant');
  const blocks = said.flatMap(({ content }) => content as Block[]);
  return {
    role: first.role,
    answered: [...new Set(said.map(({ assistantRole }) => assistantRole))],
    calls: blocks.flatMap((block) =>
      block.type === 'tool_use' ? [{ name: block.name, input: block.input as Record<string, unknown> }] : [],
    ),
    reply: blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim(),
    end,
  };
}

function threadMessagesOf(customerId: string) {
  return db
    .select({ role: assistantMessages.role, content: assistantMessages.content, assistantRole: assistants.role })
    .from(assistantMessages)
    .innerJoin(assistants, eq(assistants.id, assistantMessages.assistantId))
    .where(eq(assistantMessages.customerId, customerId))
    .orderBy(asc(assistantMessages.createdAt));
}

export function acceptSuggestion(assistant: Assistant, suggestion: { id: string; customerName: string }) {
  return turn(assistant, (emit) => answerSuggestion(assistant, suggestion, true, emit));
}

async function turn(assistant: Assistant, run: (emit: (event: TurnEvent) => void) => Promise<TurnEvent>) {
  const before = (await messagesOf(assistant)).length;
  const end = await run(() => {});
  const assistantTurns = (await messagesOf(assistant)).slice(before).filter(({ role }) => role === 'assistant');
  const blocks = assistantTurns.flatMap(({ content }) => content as Block[]);
  return {
    calls: blocks.flatMap((block) =>
      block.type === 'tool_use' ? [{ name: block.name, input: block.input as Record<string, unknown> }] : [],
    ),
    reply: blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim(),
    end,
  } satisfies Turn;
}

function messagesOf(assistant: Assistant) {
  return db
    .select({ role: assistantMessages.role, content: assistantMessages.content })
    .from(assistantMessages)
    .where(eq(assistantMessages.assistantId, assistant.id))
    .orderBy(asc(assistantMessages.createdAt));
}

export function called(name: string, input?: Record<string, unknown>) {
  return expect.objectContaining({ name, ...(input && { input: expect.objectContaining(input) }) });
}
