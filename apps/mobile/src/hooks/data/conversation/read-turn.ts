import type { QueryKey } from '@tanstack/react-query';
import { unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { idleTurn, nextTurn, type Turn, type TurnEvent } from '@/lib/turn';

export async function readTurn(
  queryKey: QueryKey,
  request: Promise<{ data: AsyncIterable<{ data: TurnEvent }> | null; error: unknown }>,
  setTurn: (update: (turn: Turn) => Turn) => void,
  onAssistant?: (assistantId: string) => void,
) {
  let failed = false;
  try {
    for await (const { data: event } of await unwrap(request)) {
      if (event.type === 'assistant') onAssistant?.(event.assistantId);
      if (event.type === 'error') failed = true;
      if (event.type === 'message') await queryClient.invalidateQueries({ queryKey });
      setTurn((turn) => nextTurn(turn, event));
    }
  } finally {
    await queryClient.invalidateQueries({ queryKey });
    setTurn(() => idleTurn);
  }
  if (failed) throw new Error('The Assistant could not finish the turn');
}
