import type { QueryKey } from '@tanstack/react-query';
import { unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

type TurnEvent =
  | { type: 'assistant'; assistantId: string }
  | { type: 'text'; text: string }
  | { type: 'message' | 'awaiting_confirmation' | 'done' | 'error' };

export async function readTurn(
  queryKey: QueryKey,
  request: Promise<{ data: AsyncIterable<{ data: TurnEvent }> | null; error: unknown }>,
  setDraft: (update: (draft: string) => string) => void,
  onAssistant?: (assistantId: string) => void,
) {
  let failed = false;
  try {
    for await (const { data: event } of await unwrap(request)) {
      if (event.type === 'assistant') onAssistant?.(event.assistantId);
      if (event.type === 'text') setDraft((draft) => draft + event.text);
      if (event.type === 'error') failed = true;
      if (event.type === 'message') {
        await queryClient.invalidateQueries({ queryKey });
        setDraft(() => '');
      }
    }
  } finally {
    await queryClient.invalidateQueries({ queryKey });
    setDraft(() => '');
  }
  if (failed) throw new Error('The Assistant could not finish the turn');
}
