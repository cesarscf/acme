import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { idleTurn } from '@/lib/turn';
import { conversationKeys } from './keys';
import { readTurn } from './read-turn';
import type { Conversation } from './use-conversation-query';

export function useSendMessageMutation(assistantId: string) {
  const [turn, setTurn] = useState(idleTurn);
  const mutation = useMutation({
    mutationFn: (text: string) =>
      readTurn(conversationKeys.detail(assistantId), api.team({ id: assistantId }).messages.post({ text }), setTurn),
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(assistantId) });
      queryClient.setQueryData<Conversation>(
        conversationKeys.detail(assistantId),
        (conversation) =>
          conversation && {
            ...conversation,
            items: [...conversation.items, { id: `sending-${Date.now()}`, type: 'professional', text }],
          },
      );
    },
  });
  return { ...mutation, draft: turn.draft, activity: turn.status };
}
