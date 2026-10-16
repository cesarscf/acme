import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { idleTurn } from '@/lib/turn';
import { conversationKeys } from './keys';
import { readTurn } from './read-turn';

export function useConfirmationMutation(assistantId: string) {
  const [turn, setTurn] = useState(idleTurn);
  const mutation = useMutation({
    mutationFn: ({ confirmationId, confirmed }: { confirmationId: string; confirmed: boolean }) =>
      readTurn(
        conversationKeys.detail(assistantId),
        api.team({ id: assistantId }).confirmations({ confirmationId }).post({ confirmed }),
        setTurn,
      ),
  });
  return { ...mutation, draft: turn.draft, activity: turn.status };
}
