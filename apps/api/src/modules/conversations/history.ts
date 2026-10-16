import { assistantMessages, db, jobs, toolConfirmations } from '@acme/db';
import type Anthropic from '@anthropic-ai/sdk';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { AssistantRole } from '../team/catalog';
import { agendaCard } from '../visits/agenda';
import { loadNotices, loadTimedItems } from './notices';
import type { Assistant } from './service';
import { assistantTools, type ConfirmationCard, findTool } from './tools';

export type Block = Anthropic.Beta.BetaContentBlockParam;
export type ToolUse = Anthropic.Beta.BetaToolUseBlock;
export type StoredMessage = typeof assistantMessages.$inferSelect & { content: Block[] };

export type TimedItems = { at: Date; jobId: string | null; items: ConversationItem[] };

export type ConversationItem =
  | { id: string; type: 'professional'; text: string }
  | { id: string; type: 'assistant'; text: string }
  | { id: string; type: 'notice'; text: string }
  | ({ id: string; type: 'agenda' } & Awaited<ReturnType<typeof agendaCard>>)
  | {
      id: string;
      type: 'activity';
      customer: { id: string; name: string };
      itemId: string;
      jobId: string | null;
      text: string;
      at: Date;
    }
  | { id: string; type: 'handoff'; role: AssistantRole; text: string }
  | ({ id: string; type: 'confirmation'; status: 'pending' | 'confirmed' | 'cancelled' } & ConfirmationCard)
  | {
      id: string;
      type: 'suggestion';
      action: 'book_visit';
      question: string;
      message: string;
      answer: 'accepted' | 'dismissed' | null;
    }
  | {
      id: string;
      type: 'suggestion';
      action: 'record_work';
      question: string;
      workRecordId: string | null;
      customerId: string;
    };

export async function getConversation(assistant: Assistant, working: boolean) {
  const timed = await loadTimedItems(assistant);
  // Handoffs happen only in a Customer's thread.
  const items: Exclude<ConversationItem, { type: 'handoff' }>[] = [];
  const push = (more: ConversationItem[]) => {
    for (const item of more) if (item.type !== 'handoff') items.push(item);
  };
  const pushNoticesBefore = (createdAt?: Date) => {
    while (timed[0] && (!createdAt || timed[0].at < createdAt)) push(timed.shift()!.items);
  };
  for (const message of await messageItems(assistant, null)) {
    pushNoticesBefore(message.at);
    push(message.items);
  }
  pushNoticesBefore();
  return { working, items };
}

export async function messageItems(assistant: Assistant, customerId: string | null): Promise<TimedItems[]> {
  const messages = await loadMessages(assistant.id, customerId);
  const confirmations = await db
    .select()
    .from(toolConfirmations)
    .where(eq(toolConfirmations.assistantId, assistant.id));
  const tools = assistantTools(assistant);
  const timed: TimedItems[] = [];
  // In the Assistant's chat, the Visits listed for an @agenda message show as the Agenda card, once per message.
  let agendaAsked = false;
  for (const message of messages) {
    const items: ConversationItem[] = [];
    // A teammate's request shows as the handoff of whoever asked, not as the Professional's words.
    const text = message.content
      .flatMap((block) => (block.type === 'text' && !block.text.startsWith('<colega') ? [block.text] : []))
      .join('\n\n')
      .trim();
    if (text) items.push({ id: message.id, type: message.role === 'user' ? 'professional' : 'assistant', text });
    if (message.role === 'user' && text) agendaAsked = !customerId && /(^|\s)@agenda\b/u.test(text);
    for (const block of message.content) {
      if (block.type !== 'tool_use') continue;
      if (block.name === 'listVisits' && agendaAsked) {
        agendaAsked = false;
        const { from, to } = block.input as { from: string; to: string };
        items.push({ id: block.id, type: 'agenda', ...(await agendaCard(assistant.professional, from, to)) });
        continue;
      }
      if (block.name === 'askTeammate') {
        const { role, message: request } = block.input as { role: AssistantRole; message: string };
        items.push({ id: block.id, type: 'handoff', role, text: request });
        continue;
      }
      const confirmation = confirmations.find(({ toolUseId }) => toolUseId === block.id);
      const card = findTool(tools, block.name)?.card;
      if (confirmation && card) {
        items.push({
          id: confirmation.id,
          type: 'confirmation',
          status: confirmation.status,
          ...(await card(block.input)),
        });
      }
    }
    if (items.length) timed.push({ at: message.createdAt, jobId: message.jobId, items });
  }
  return timed;
}

export async function loadMessages(assistantId: string, customerId: string | null) {
  const rows = await db
    .select()
    .from(assistantMessages)
    .where(
      and(
        eq(assistantMessages.assistantId, assistantId),
        customerId ? eq(assistantMessages.customerId, customerId) : isNull(assistantMessages.customerId),
      ),
    )
    .orderBy(asc(assistantMessages.createdAt));
  return rows as StoredMessage[];
}

export async function apiMessages(assistant: Assistant) {
  const messages = await loadMessages(assistant.id, assistant.customer?.id ?? null);
  // Notices belong to the Assistant's chat; in a Customer's thread the history goes in the prompt.
  const notices = assistant.customer ? [] : await loadNotices(assistant.id);
  // The API ignores what comes before a compaction summary, so it is not sent at all.
  const summarized = messages.findLastIndex(({ content }) =>
    content.some((block) => block.type === 'compaction' && block.content),
  );
  const sent = messages.map(({ role, content, createdAt }) => {
    const arrived = role === 'user' ? notices.filter((notice) => notice.createdAt < createdAt) : [];
    notices.splice(0, arrived.length);
    if (!arrived.length) return { role, content };
    const results = content.filter((block) => block.type === 'tool_result');
    const rest = content.filter((block) => block.type !== 'tool_result');
    const texts = arrived.map(({ text }): Block => ({ type: 'text', text: `<aviso>${text}</aviso>` }));
    return { role, content: [...results, ...texts, ...rest] };
  });
  return sent.slice(Math.max(summarized, 0));
}

export async function saveMessage({ id, customer }: Assistant, role: 'user' | 'assistant', content: Block[]) {
  // Read at each save: a tool earlier in the turn can open the Job (a Visit or Quote for a Customer without one).
  const [open] = customer
    ? await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.customerId, customer.id), eq(jobs.status, 'open')))
    : [];
  const [stored] = await db
    .insert(assistantMessages)
    .values({ assistantId: id, role, content, customerId: customer?.id, jobId: open?.id })
    .returning();
  return stored as StoredMessage;
}

export function toolUses(message: StoredMessage) {
  return message.content.filter((block): block is ToolUse => block.type === 'tool_use');
}
