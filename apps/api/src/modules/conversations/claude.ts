import { db, llmUsages } from '@acme/db';
import Anthropic from '@anthropic-ai/sdk';

// Haiku 5.5 by default to keep the M1 bill low; CLAUDE_MODEL=claude-opus-5-5 switches to the model of ADR 0006.
const defaultModel = 'claude-haiku-5-5';
// Haiku 5.5 has no server-side fallback: the API rejects a fallback list and ignores "default".
const modelsWithServerFallback = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

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
