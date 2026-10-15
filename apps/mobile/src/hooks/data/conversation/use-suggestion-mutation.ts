import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from './keys';
import { readTurn } from './read-turn';
import type { Conversation } from './use-conversation-query';

// A suggestion from another Assistant's work, answered with one tap: accepting asks this Assistant, as if typed.
export function useSuggestionMutation(assistantId: string) {
  const [draft, setDraft] = useState('');
  const mutation = useMutation({
    mutationFn: ({ suggestionId, accepted }: { suggestionId: string; accepted: boolean; message: string }) =>
      readTurn(assistantId, api.team({ id: assistantId }).suggestions({ suggestionId }).post({ accepted }), setDraft),
    onMutate: async ({ suggestionId, accepted, message }) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(assistantId) });
      queryClient.setQueryData<Conversation>(
        conversationKeys.detail(assistantId),
        (conversation) =>
          conversation && {
            ...conversation,
            items: [
              ...conversation.items.map((item) =>
                item.type === 'suggestion' && item.action === 'book_visit' && item.id === suggestionId
                  ? { ...item, answer: accepted ? ('accepted' as const) : ('dismissed' as const) }
                  : item,
              ),
              ...(accepted ? [{ id: `sending-${Date.now()}`, type: 'professional' as const, text: message }] : []),
            ],
          },
      );
    },
  });
  return { ...mutation, draft };
}
