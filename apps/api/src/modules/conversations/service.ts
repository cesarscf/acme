import {
  assistantMessages,
  assistantNotices,
  assistants,
  customers,
  db,
  jobs,
  llmUsages,
  professionals,
  toolConfirmations,
  visits,
  workRecords,
} from '@acme/db';
import Anthropic from '@anthropic-ai/sdk';
import { runRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { and, asc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { type AssistantRole, catalogEntry } from '../team/catalog';
import { formatLocalDateTime } from '../visits/time';
import { type PromptContext, systemPrompt } from './prompts';
import { type AssistantTool, assistantTools, type ConfirmationCard } from './tools';

type Block = Anthropic.Beta.BetaContentBlockParam;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;
type StoredMessage = typeof assistantMessages.$inferSelect & { content: Block[] };

export type Assistant = PromptContext & { id: string; professional: PromptContext['professional'] & { id: string } };

export type TimedItems = { at: Date; jobId: string | null; items: ConversationItem[] };

export type TurnEvent =
  | { type: 'assistant'; assistantId: string }
  | { type: 'text'; text: string }
  | { type: 'message' }
  | { type: 'awaiting_confirmation' }
  | { type: 'done' }
  | { type: 'error' };

export type ConversationItem =
  | { id: string; type: 'professional'; text: string }
  | { id: string; type: 'assistant'; text: string }
  | { id: string; type: 'notice'; text: string }
  | ({ id: string; type: 'confirmation'; status: 'pending' | 'confirmed' | 'cancelled' } & ConfirmationCard)
  | {
      id: string;
      type: 'suggestion';
      action: 'book_visit';
      question: string;
      message: string;
      answer: 'accepted' | 'dismissed' | null;
    }
  | { id: string; type: 'suggestion'; action: 'record_work'; question: string; workRecordId: string | null };

type Suggestion = { suggestion: 'book_visit'; customerId: string };

// Haiku 5.5 by default to keep the M1 bill low; CLAUDE_MODEL=claude-opus-5-5 switches to the model of ADR 0006.
const defaultModel = 'claude-haiku-5-5';
// Haiku 5.5 has no server-side fallback: the API rejects a fallback list and ignores "default".
const modelsWithServerFallback = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];
const refusalText = 'Não posso ajudar com esse pedido.';
const truncatedText = 'Me perdi no meio dessa tarefa. Pode pedir de novo?';
const cancelledResult = 'O profissional cancelou. Nada foi enviado ao cliente.';
const abandonedResult = 'Não executado: o profissional mandou outra mensagem antes.';
// Same window as the Visits a WorkRecord can be about.
const endedVisitDays = 7;

// One turn at a time per Assistant, with the Customer whose thread it is in; the API runs as a single process in M1 and M2.
const working = new Map<string, string | null>();

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

export function isWorking(assistantId: string) {
  return working.has(assistantId);
}

// Held from a message's arrival until its turn starts: picking who answers takes a Claude call, and a second message must wait.
const claimedThreads = new Set<string>();

export function isCustomerWorking(customerId: string) {
  return claimedThreads.has(customerId) || [...working.values()].includes(customerId);
}

export function claimCustomerThread(customerId: string) {
  if (isCustomerWorking(customerId)) return false;
  claimedThreads.add(customerId);
  return true;
}

export function releaseCustomerThread(customerId: string) {
  claimedThreads.delete(customerId);
}

export async function getConversation(assistant: Assistant) {
  const timed = await loadTimedItems(assistant);
  const items: ConversationItem[] = [];
  const pushNoticesBefore = (createdAt?: Date) => {
    while (timed[0] && (!createdAt || timed[0].at < createdAt)) items.push(...timed.shift()!.items);
  };
  for (const message of await messageItems(assistant, null)) {
    pushNoticesBefore(message.at);
    items.push(...message.items);
  }
  pushNoticesBefore();
  return { working: isWorking(assistant.id), items };
}

export async function messageItems(assistant: Assistant, customerId: string | null): Promise<TimedItems[]> {
  const messages = await loadMessages(assistant.id, customerId);
  const confirmations = await db
    .select()
    .from(toolConfirmations)
    .where(eq(toolConfirmations.assistantId, assistant.id));
  const tools = assistantTools(assistant);
  const timed: TimedItems[] = [];
  for (const message of messages) {
    const items: ConversationItem[] = [];
    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n\n')
      .trim();
    if (text) items.push({ id: message.id, type: message.role === 'user' ? 'professional' : 'assistant', text });
    for (const block of message.content) {
      if (block.type !== 'tool_use') continue;
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

export async function listThreadAssistants(professionalId: string, customerId: string) {
  const rows = await db
    .selectDistinct({ id: assistantMessages.assistantId })
    .from(assistantMessages)
    .innerJoin(assistants, eq(assistants.id, assistantMessages.assistantId))
    .where(and(eq(assistantMessages.customerId, customerId), eq(assistants.professionalId, professionalId)));
  const found = await Promise.all(rows.map(({ id }) => findAssistant(professionalId, id)));
  return found.filter((assistant) => !!assistant);
}

export function speaker({ id, name, role }: Assistant) {
  const { title, mascot } = catalogEntry(role);
  return { id, name, title, mascot };
}

async function loadTimedItems(assistant: Assistant) {
  const notices = await db
    .select({
      id: assistantNotices.id,
      text: assistantNotices.text,
      createdAt: assistantNotices.createdAt,
      suggestion: assistantNotices.suggestion,
      suggestionAnswer: assistantNotices.suggestionAnswer,
      customerName: customers.name,
    })
    .from(assistantNotices)
    .leftJoin(customers, eq(customers.id, assistantNotices.customerId))
    .where(eq(assistantNotices.assistantId, assistant.id))
    .orderBy(asc(assistantNotices.createdAt));
  const timed = notices.map(({ id, text, createdAt, suggestion, suggestionAnswer, customerName }) => {
    const items: ConversationItem[] = [{ id, type: 'notice', text }];
    if (suggestion === 'book_visit' && customerName) {
      items.push({
        id,
        type: 'suggestion',
        action: 'book_visit',
        question: `Quer que eu marque a visita de ${customerName}?`,
        message: bookVisitMessage(customerName),
        answer: suggestionAnswer,
      });
    }
    return { at: createdAt, items };
  });
  if (assistant.role === 'scheduling') timed.push(...(await loadEndedVisits(assistant.professional)));
  return timed.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function bookVisitMessage(customerName: string) {
  return `Marcar a visita de ${customerName}`;
}

async function loadEndedVisits(professional: Assistant['professional']) {
  const now = new Date();
  const endsAt = sql<Date>`${visits.scheduledAt} + make_interval(mins => ${visits.durationMinutes})`;
  const ended = await db
    .select({
      id: visits.id,
      scheduledAt: visits.scheduledAt,
      endsAt: endsAt.mapWith((value: string) => new Date(value)),
      customerName: customers.name,
    })
    .from(visits)
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .where(
      and(
        eq(visits.professionalId, professional.id),
        inArray(visits.status, ['scheduled', 'confirmed']),
        gte(visits.scheduledAt, new Date(now.getTime() - endedVisitDays * 86_400_000)),
        sql`${endsAt} <= ${now.toISOString()}`,
      ),
    );
  const recorded = ended.length
    ? await db
        .select({ id: workRecords.id, visitId: workRecords.visitId })
        .from(workRecords)
        .where(
          inArray(
            workRecords.visitId,
            ended.map(({ id }) => id),
          ),
        )
    : [];
  return ended.map((visit) => ({
    at: visit.endsAt,
    items: [
      {
        id: visit.id,
        type: 'suggestion' as const,
        action: 'record_work' as const,
        question: `Terminou a visita de ${visit.customerName}, ${formatLocalDateTime(visit.scheduledAt, professional.timezone)}?`,
        workRecordId: recorded.find(({ visitId }) => visitId === visit.id)?.id ?? null,
      },
    ],
  }));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Notices go to the Professional's Assistant with that Role; without one, nobody is there to tell.
export async function addNotice(
  tx: Transaction,
  professionalId: string,
  role: AssistantRole,
  text: string,
  suggestion?: Suggestion,
) {
  const [assistant] = await tx
    .select({ id: assistants.id })
    .from(assistants)
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, role)));
  if (assistant) await tx.insert(assistantNotices).values({ assistantId: assistant.id, text, ...suggestion });
}

export async function findOpenSuggestion(assistantId: string, id: string) {
  const [suggestion] = await db
    .select({ id: assistantNotices.id, customerName: customers.name })
    .from(assistantNotices)
    .innerJoin(customers, eq(customers.id, assistantNotices.customerId))
    .where(
      and(
        eq(assistantNotices.id, id),
        eq(assistantNotices.assistantId, assistantId),
        isNotNull(assistantNotices.suggestion),
        isNull(assistantNotices.suggestionAnswer),
      ),
    );
  return suggestion;
}

// The suggestion's one tap: accepting it is the Professional asking the Assistant, as if typed; nothing else happens on its own.
export async function answerSuggestion(
  assistant: Assistant,
  suggestion: { id: string; customerName: string },
  accepted: boolean,
  emit: (event: TurnEvent) => void,
): Promise<TurnEvent> {
  const [answered] = await db
    .update(assistantNotices)
    .set({ suggestionAnswer: accepted ? 'accepted' : 'dismissed' })
    .where(and(eq(assistantNotices.id, suggestion.id), isNull(assistantNotices.suggestionAnswer)))
    .returning({ id: assistantNotices.id });
  if (!answered || !accepted) return { type: 'done' };
  return sendText(assistant, bookVisitMessage(suggestion.customerName), emit);
}

// A card belongs where it was shown: the Assistant's chat (no Customer) or one Customer's thread.
export async function findPendingConfirmation(assistantId: string, id: string, customerId: string | null) {
  const [row] = await db
    .select({ confirmation: toolConfirmations })
    .from(toolConfirmations)
    .innerJoin(assistantMessages, eq(assistantMessages.id, toolConfirmations.messageId))
    .where(
      and(
        eq(toolConfirmations.id, id),
        eq(toolConfirmations.assistantId, assistantId),
        eq(toolConfirmations.status, 'pending'),
        customerId ? eq(assistantMessages.customerId, customerId) : isNull(assistantMessages.customerId),
      ),
    );
  return row?.confirmation;
}

// Starts the turn right away and streams its events; the turn finishes and is saved even if the app disconnects.
export function startTurn(assistant: Assistant, turn: (emit: (event: TurnEvent) => void) => Promise<TurnEvent>) {
  const assistantId = assistant.id;
  const events: TurnEvent[] = [];
  let finished = false;
  let wake = () => {};
  working.set(assistantId, assistant.customer?.id ?? null);
  turn((event) => {
    events.push(event);
    wake();
  })
    .catch((error): TurnEvent => {
      console.error(`Turn of Assistant ${assistantId} failed`, error);
      return { type: 'error' };
    })
    .then((last) => {
      events.push(last);
      finished = true;
      working.delete(assistantId);
      wake();
    });
  return (async function* () {
    for (;;) {
      const event = events.shift();
      if (event) yield event;
      else if (finished) return;
      else await new Promise<void>((resolve) => (wake = resolve));
    }
  })();
}

export async function sendText(assistant: Assistant, text: string, emit: (event: TurnEvent) => void) {
  const last = (await loadMessages(assistant.id, assistant.customer?.id ?? null)).at(-1);
  // A paused turn is abandoned: every call in it gets a result, so the history stays valid for the API.
  const abandoned: ToolResult[] =
    last?.role === 'assistant' ? toolUses(last).map((call) => result(call, abandonedResult)) : [];
  if (last && abandoned.length) {
    await db
      .update(toolConfirmations)
      .set({ status: 'cancelled', decidedAt: new Date() })
      .where(and(eq(toolConfirmations.messageId, last.id), eq(toolConfirmations.status, 'pending')));
  }
  await saveMessage(assistant, 'user', [...abandoned, { type: 'text', text }]);
  return converse(assistant, emit);
}

export async function decide(
  assistant: Assistant,
  confirmation: typeof toolConfirmations.$inferSelect,
  confirmed: boolean,
  emit: (event: TurnEvent) => void,
): Promise<TurnEvent> {
  await db
    .update(toolConfirmations)
    .set({ status: confirmed ? 'confirmed' : 'cancelled', decidedAt: new Date() })
    .where(eq(toolConfirmations.id, confirmation.id));
  const siblings = await db
    .select({ toolUseId: toolConfirmations.toolUseId, status: toolConfirmations.status })
    .from(toolConfirmations)
    .where(eq(toolConfirmations.messageId, confirmation.messageId));
  if (siblings.some(({ status }) => status === 'pending')) return { type: 'awaiting_confirmation' };

  const [message] = await db.select().from(assistantMessages).where(eq(assistantMessages.id, confirmation.messageId));
  const tools = assistantTools(assistant);
  const results: ToolResult[] = [];
  for (const call of toolUses(message as StoredMessage)) {
    const decision = siblings.find(({ toolUseId }) => toolUseId === call.id)?.status;
    if (findTool(tools, call.name)?.card && decision !== 'confirmed') results.push(result(call, cancelledResult));
    else results.push(await run(tools, call));
  }
  await saveMessage(assistant, 'user', results);
  return converse(assistant, emit);
}

async function converse(assistant: Assistant, emit: (event: TurnEvent) => void): Promise<TurnEvent> {
  const tools = assistantTools(assistant);
  const { betas = [], ...model } = modelParams();
  const runner = claude().beta.messages.toolRunner({
    ...model,
    betas: [...betas, 'compact-2026-01-12'],
    max_tokens: 16000,
    stream: true,
    max_iterations: 20,
    // Short chat replies on a phone; low effort spends the fewest tokens.
    output_config: { effort: 'low' },
    cache_control: { type: 'ephemeral' },
    system: systemPrompt(assistant),
    tools: tools.map(({ tool }) => tool),
    // Haiku 5.5 bills prompts over 100K tokens at a higher rate, so the server summarizes the history before that.
    context_management: { edits: [{ type: 'compact_20260112', trigger: { type: 'input_tokens', value: 100_000 } }] },
    messages: await apiMessages(assistant),
  });

  for await (const stream of runner) {
    stream.on('text', (text) => emit({ type: 'text', text }));
    const message = await stream.finalMessage();
    await recordUsage(assistant, message);
    const calls = message.content.filter((block) => block.type === 'tool_use');

    // A refusal or a cut-off call can leave a half-written tool input, so that turn's tools never run.
    if (message.stop_reason === 'refusal' || (message.stop_reason === 'max_tokens' && calls.length)) {
      const text = message.stop_reason === 'refusal' ? refusalText : truncatedText;
      await saveMessage(assistant, 'assistant', [{ type: 'text', text }]);
      emit({ type: 'message' });
      return { type: 'done' };
    }

    const stored = (await saveMessage(assistant, 'assistant', echoable(message.content))) as StoredMessage;
    // Calls the stored history keeps; after a fallback, the declined model's calls are not among them.
    const kept = toolUses(stored);
    emit({ type: 'message' });

    if (!kept.length) return { type: 'done' };

    const gated = kept.filter((call) => findTool(tools, call.name)?.card);
    if (gated.length) {
      await db
        .insert(toolConfirmations)
        .values(gated.map((call) => ({ assistantId: assistant.id, messageId: stored.id, toolUseId: call.id })));
      return { type: 'awaiting_confirmation' };
    }

    const results = await Promise.all(kept.map((call) => run(tools, call)));
    await saveMessage(assistant, 'user', results);
    // The runner's own copy of the reply still has the declined model's calls, so it goes on from the stored one.
    runner.pushMessages({ role: 'assistant', content: stored.content }, { role: 'user', content: results });
  }
  return { type: 'done' };
}

// The SDK reads ANTHROPIC_WORKSPACE_ID only for OIDC federation; an API key outside a workspace needs the header.
export function claude() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {});
}

export function modelParams() {
  const model = process.env.CLAUDE_MODEL || defaultModel;
  return {
    model,
    ...(modelsWithServerFallback.includes(model) && {
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    }),
  };
}

async function run(tools: AssistantTool[], call: ToolUse): Promise<ToolResult> {
  const entry = findTool(tools, call.name);
  if (!entry) return result(call, `Ferramenta desconhecida: ${call.name}`, true);
  const { content, isError } = await runRunnableTool(entry.tool, call.input, { toolUse: call, toolUseBlock: call });
  return result(call, content, isError);
}

function result(call: ToolUse, content: ToolResult['content'], isError = false): ToolResult {
  return { type: 'tool_result', tool_use_id: call.id, content, ...(isError && { is_error: true }) };
}

function findTool(tools: AssistantTool[], name: string) {
  return tools.find(({ tool }) => tool.name === name);
}

function toolUses(message: StoredMessage) {
  return message.content.filter((block): block is ToolUse => block.type === 'tool_use');
}

// After a mid-output fallback, blocks of the declined model before the last switch point are not sent back.
function echoable(content: Anthropic.Beta.BetaContentBlock[]): Block[] {
  const lastSwitch = content.findLastIndex((block) => block.type === 'fallback');
  return content.filter(
    (block, index) =>
      index > lastSwitch || !['thinking', 'redacted_thinking', 'tool_use', 'server_tool_use'].includes(block.type),
  ) as Block[];
}

async function loadMessages(assistantId: string, customerId: string | null) {
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

async function apiMessages(assistant: Assistant) {
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

function loadNotices(assistantId: string) {
  return db
    .select()
    .from(assistantNotices)
    .where(eq(assistantNotices.assistantId, assistantId))
    .orderBy(asc(assistantNotices.createdAt));
}

async function saveMessage({ id, customer }: Assistant, role: 'user' | 'assistant', content: Block[]) {
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
  return stored!;
}

export async function recordUsage(
  assistant: { id: string | null; professional: { id: string } },
  message: Anthropic.Beta.BetaMessage,
) {
  // With a fallback or a compaction, each model run reports its own usage in `iterations`.
  const attempts = message.usage.iterations?.filter(
    (attempt) => attempt.type === 'message' || attempt.type === 'fallback_message' || attempt.type === 'compaction',
  ) ?? [message.usage];
  if (!attempts.length) return;
  await db.insert(llmUsages).values(
    attempts.map((attempt) => ({
      professionalId: assistant.professional.id,
      assistantId: assistant.id,
      model: ('model' in attempt && attempt.model) || message.model,
      inputTokens: attempt.input_tokens,
      outputTokens: attempt.output_tokens,
      cacheCreationInputTokens: attempt.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: attempt.cache_read_input_tokens ?? 0,
    })),
  );
}
