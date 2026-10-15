import {
  assistantMessages,
  assistantNotices,
  assistants,
  db,
  llmUsages,
  professionals,
  toolConfirmations,
} from '@acme/db';
import Anthropic from '@anthropic-ai/sdk';
import { runRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { and, asc, eq } from 'drizzle-orm';
import type { AssistantRole } from '../team/catalog';
import { type PromptContext, systemPrompt } from './prompts';
import { type AssistantTool, assistantTools, type ConfirmationCard } from './tools';

type Block = Anthropic.Beta.BetaContentBlockParam;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;
type StoredMessage = typeof assistantMessages.$inferSelect & { content: Block[] };

export type Assistant = PromptContext & { id: string; professional: PromptContext['professional'] & { id: string } };

export type TurnEvent =
  | { type: 'text'; text: string }
  | { type: 'message' }
  | { type: 'awaiting_confirmation' }
  | { type: 'done' }
  | { type: 'error' };

export type ConversationItem =
  | { id: string; type: 'professional'; text: string }
  | { id: string; type: 'assistant'; text: string }
  | { id: string; type: 'notice'; text: string }
  | ({ id: string; type: 'confirmation'; status: 'pending' | 'confirmed' | 'cancelled' } & ConfirmationCard);

// Haiku 5.5 by default to keep the M1 bill low; CLAUDE_MODEL=claude-opus-5-5 switches to the model of ADR 0006.
const defaultModel = 'claude-haiku-5-5';
// Haiku 5.5 has no server-side fallback: the API rejects a fallback list and ignores "default".
const modelsWithServerFallback = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];
const refusalText = 'Não posso ajudar com esse pedido.';
const truncatedText = 'Me perdi no meio dessa tarefa. Pode pedir de novo?';
const cancelledResult = 'O profissional cancelou. Nada foi enviado ao cliente.';
const abandonedResult = 'Não executado: o profissional mandou outra mensagem antes.';

// One turn at a time per Assistant; the API runs as a single process in M1 and M2.
const working = new Set<string>();

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

export async function getConversation(assistant: Assistant) {
  const messages = await loadMessages(assistant.id);
  const notices = await loadNotices(assistant.id);
  const confirmations = await db
    .select()
    .from(toolConfirmations)
    .where(eq(toolConfirmations.assistantId, assistant.id));
  const tools = assistantTools(assistant);
  const items: ConversationItem[] = [];
  const pushNoticesBefore = (createdAt?: Date) => {
    while (notices[0] && (!createdAt || notices[0].createdAt < createdAt)) {
      const { id, text } = notices.shift()!;
      items.push({ id, type: 'notice', text });
    }
  };
  for (const message of messages) {
    pushNoticesBefore(message.createdAt);
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
  }
  pushNoticesBefore();
  return { working: isWorking(assistant.id), items };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Notices go to the Professional's Assistant with that Role; without one, nobody is there to tell.
export async function addNotice(tx: Transaction, professionalId: string, role: AssistantRole, text: string) {
  const [assistant] = await tx
    .select({ id: assistants.id })
    .from(assistants)
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, role)));
  if (assistant) await tx.insert(assistantNotices).values({ assistantId: assistant.id, text });
}

export function findPendingConfirmation(assistantId: string, id: string) {
  return db.query.toolConfirmations.findFirst({
    where: and(
      eq(toolConfirmations.id, id),
      eq(toolConfirmations.assistantId, assistantId),
      eq(toolConfirmations.status, 'pending'),
    ),
  });
}

// Starts the turn right away and streams its events; the turn finishes and is saved even if the app disconnects.
export function startTurn(assistantId: string, turn: (emit: (event: TurnEvent) => void) => Promise<TurnEvent>) {
  const events: TurnEvent[] = [];
  let finished = false;
  let wake = () => {};
  working.add(assistantId);
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
  const last = (await loadMessages(assistant.id)).at(-1);
  // A paused turn is abandoned: every call in it gets a result, so the history stays valid for the API.
  const abandoned: ToolResult[] =
    last?.role === 'assistant' ? toolUses(last).map((call) => result(call, abandonedResult)) : [];
  if (last && abandoned.length) {
    await db
      .update(toolConfirmations)
      .set({ status: 'cancelled', decidedAt: new Date() })
      .where(and(eq(toolConfirmations.messageId, last.id), eq(toolConfirmations.status, 'pending')));
  }
  await saveMessage(assistant.id, 'user', [...abandoned, { type: 'text', text }]);
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
    const entry = findTool(tools, call.name);
    const decision = siblings.find(({ toolUseId }) => toolUseId === call.id)?.status;
    if (!entry) results.push(result(call, `Ferramenta desconhecida: ${call.name}`, true));
    else if (entry.card && decision !== 'confirmed') results.push(result(call, cancelledResult));
    else results.push(await run(entry, call));
  }
  await saveMessage(assistant.id, 'user', results);
  return converse(assistant, emit);
}

async function converse(assistant: Assistant, emit: (event: TurnEvent) => void): Promise<TurnEvent> {
  const tools = assistantTools(assistant);
  const runner = claude().beta.messages.toolRunner({
    ...modelParams(),
    max_tokens: 16000,
    stream: true,
    max_iterations: 20,
    // Short chat replies on a phone; low effort spends the fewest tokens.
    output_config: { effort: 'low' },
    cache_control: { type: 'ephemeral' },
    system: systemPrompt(assistant),
    tools: tools.map(({ tool }) => tool),
    messages: await apiMessages(assistant.id),
  });

  for await (const stream of runner) {
    stream.on('text', (text) => emit({ type: 'text', text }));
    const message = await stream.finalMessage();
    await recordUsage(assistant, message);
    const calls = message.content.filter((block) => block.type === 'tool_use');

    // A refusal or a cut-off call can leave a half-written tool input, so that turn's tools never run.
    if (message.stop_reason === 'refusal' || (message.stop_reason === 'max_tokens' && calls.length)) {
      const text = message.stop_reason === 'refusal' ? refusalText : truncatedText;
      await saveMessage(assistant.id, 'assistant', [{ type: 'text', text }]);
      emit({ type: 'message' });
      return { type: 'done' };
    }

    const stored = await saveMessage(assistant.id, 'assistant', echoable(message.content));
    // Calls the stored history keeps; after a fallback, the declined model's calls are not among them.
    const kept = toolUses(stored as StoredMessage);
    emit({ type: 'message' });

    const gated = kept.filter((call) => findTool(tools, call.name)?.card);
    if (gated.length) {
      await db
        .insert(toolConfirmations)
        .values(gated.map((call) => ({ assistantId: assistant.id, messageId: stored.id, toolUseId: call.id })));
      return { type: 'awaiting_confirmation' };
    }

    const toolResponse = await runner.generateToolResponse();
    if (toolResponse && typeof toolResponse.content !== 'string') {
      const results = toolResponse.content.filter(
        (block) => block.type !== 'tool_result' || kept.some(({ id }) => id === block.tool_use_id),
      );
      await saveMessage(assistant.id, 'user', results);
    }
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

async function run(entry: AssistantTool, call: ToolUse): Promise<ToolResult> {
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

async function loadMessages(assistantId: string) {
  const rows = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.assistantId, assistantId))
    .orderBy(asc(assistantMessages.createdAt));
  return rows as StoredMessage[];
}

// Each notice reaches Claude in the first user turn saved after it (a Professional's message or tool results).
async function apiMessages(assistantId: string) {
  const messages = await loadMessages(assistantId);
  const notices = await loadNotices(assistantId);
  return messages.map(({ role, content, createdAt }) => {
    const arrived = role === 'user' ? notices.filter((notice) => notice.createdAt < createdAt) : [];
    notices.splice(0, arrived.length);
    if (!arrived.length) return { role, content };
    const results = content.filter((block) => block.type === 'tool_result');
    const rest = content.filter((block) => block.type !== 'tool_result');
    const texts = arrived.map(({ text }): Block => ({ type: 'text', text: `<aviso>${text}</aviso>` }));
    return { role, content: [...results, ...texts, ...rest] };
  });
}

function loadNotices(assistantId: string) {
  return db
    .select()
    .from(assistantNotices)
    .where(eq(assistantNotices.assistantId, assistantId))
    .orderBy(asc(assistantNotices.createdAt));
}

async function saveMessage(assistantId: string, role: 'user' | 'assistant', content: Block[]) {
  const [stored] = await db.insert(assistantMessages).values({ assistantId, role, content }).returning();
  return stored!;
}

export async function recordUsage(
  assistant: { id: string | null; professional: { id: string } },
  message: Anthropic.Beta.BetaMessage,
) {
  // With a fallback, each model that ran reports its own usage in `iterations`.
  const attempts = message.usage.iterations?.filter(
    (attempt) => attempt.type === 'message' || attempt.type === 'fallback_message',
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
