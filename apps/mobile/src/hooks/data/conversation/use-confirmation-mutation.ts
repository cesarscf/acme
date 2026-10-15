import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { readTurn } from './read-turn';

export function useConfirmationMutation(assistantId: string) {
  const [draft, setDraft] = useState('');
  const mutation = useMutation({
    mutationFn: ({ confirmationId, confirmed }: { confirmationId: string; confirmed: boolean }) =>
      readTurn(
        assistantId,
        api.team({ id: assistantId }).confirmations({ confirmationId }).post({ confirmed }),
        setDraft,
      ),
  });
  return { ...mutation, draft };
}
