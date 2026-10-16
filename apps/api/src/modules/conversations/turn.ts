import { assistantMessages, assistantNotices, db, toolConfirmations } from '@acme/db';
import type Anthropic from '@anthropic-ai/sdk';
import { runRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { and, eq, isNull } from 'drizzle-orm';
import { roles } from '../team/roles';
import { claude, modelParams, recordUsage } from './claude';
import {
  apiMessages,
  type Block,
  loadMessages,
  type StoredMessage,
  saveMessage,
  type ToolUse,
  toolUses,
} from './history';
import { systemPrompt } from './prompts';
import { freeTurn, holdTurn, renewMs, renewTurn } from './running-turns';
import type { Assistant } from './service';
import { type AssistantTool, assistantTools, findTool } from './tools';

type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export type TurnEvent =
  | { type: 'assistant'; assistantId: string }
  | { type: 'text'; text: string }
  | { type: 'message' }
  | { type: 'awaiting_confirmation' }
  | { type: 'done' }
  | { type: 'error' };

const refusalText = 'Não posso ajudar com esse pedido.';
const truncatedText = 'Me perdi no meio dessa tarefa. Pode pedir de novo?';
const cancelledResult = 'O profissional cancelou. Nada foi enviado ao cliente.';
const abandonedResult = 'Não executado: o profissional mandou outra mensagem antes.';

// Starts the turn right away and streams its events; the turn finishes and is saved even if the app disconnects.
export async function startTurn(
  assistant: Assistant,
  turn: (emit: (event: TurnEvent) => void) => Promise<TurnEvent>,
  claimId?: string,
) {
  const held = await holdTurn(assistant.id, claimId);
  if (!held) return undefined;
  const renew = setInterval(() => {
    renewTurn(held).catch((error) => console.error(`Renewing the turn of Assistant ${assistant.id} failed`, error));
  }, renewMs);
  const events: TurnEvent[] = [];
  let finished = false;
  let wake = () => {};
  turn((event) => {
    events.push(event);
    wake();
  })
    .catch((error): TurnEvent => {
      console.error(`Turn of Assistant ${assistant.id} failed`, error);
      return { type: 'error' };
    })
    .then(async (last) => {
      clearInterval(renew);
      await freeTurn(held).catch((error) =>
        console.error(`Freeing the turn of Assistant ${assistant.id} failed`, error),
      );
      events.push(last);
      finished = true;
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
  const message = roles[assistant.role].suggestion?.message(suggestion.customerName);
  if (!answered || !accepted || !message) return { type: 'done' };
  return sendText(assistant, message, emit);
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

    const stored = await saveMessage(assistant, 'assistant', echoable(message.content));
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

async function run(tools: AssistantTool[], call: ToolUse): Promise<ToolResult> {
  const entry = findTool(tools, call.name);
  if (!entry) return result(call, `Ferramenta desconhecida: ${call.name}`, true);
  const { content, isError } = await runRunnableTool(entry.tool, call.input, { toolUse: call, toolUseBlock: call });
  return result(call, content, isError);
}

function result(call: ToolUse, content: ToolResult['content'], isError = false): ToolResult {
  return { type: 'tool_result', tool_use_id: call.id, content, ...(isError && { is_error: true }) };
}

// After a mid-output fallback, blocks of the declined model before the last switch point are not sent back.
function echoable(content: Anthropic.Beta.BetaContentBlock[]): Block[] {
  const lastSwitch = content.findLastIndex((block) => block.type === 'fallback');
  return content.filter(
    (block, index) =>
      index > lastSwitch || !['thinking', 'redacted_thinking', 'tool_use', 'server_tool_use'].includes(block.type),
  ) as Block[];
}
