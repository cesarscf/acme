import { unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from './keys';

type TurnEvent = { type: 'text'; text: string } | { type: 'message' | 'awaiting_confirmation' | 'done' | 'error' };

export async function readTurn(
  assistantId: string,
  request: Promise<{ data: AsyncIterable<{ data: TurnEvent }> | null; error: unknown }>,
  setDraft: (update: (draft: string) => string) => void,
) {
  let failed = false;
  try {
    for await (const { data: event } of await unwrap(request)) {
      if (event.type === 'text') setDraft((draft) => draft + event.text);
      if (event.type === 'error') failed = true;
      if (event.type === 'message') {
        await queryClient.invalidateQueries({ queryKey: conversationKeys.detail(assistantId) });
        setDraft(() => '');
      }
    }
  } finally {
    await queryClient.invalidateQueries({ queryKey: conversationKeys.detail(assistantId) });
    setDraft(() => '');
  }
  if (failed) throw new Error('The Assistant could not finish the turn');
}
