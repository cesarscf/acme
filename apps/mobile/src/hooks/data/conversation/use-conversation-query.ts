import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { conversationKeys } from './keys';

function getConversation(assistantId: string) {
  return unwrap(api.team({ id: assistantId }).messages.get());
}

export type Conversation = Awaited<ReturnType<typeof getConversation>>;
export type ConversationItem = Conversation['items'][number];

export function useConversationQuery(assistantId: string) {
  return useQuery({
    queryKey: conversationKeys.detail(assistantId),
    queryFn: () => getConversation(assistantId),
    // A turn goes on when the app leaves the conversation, so a reopened one polls until the turn ends.
    refetchInterval: (query) => (query.state.data?.working ? 1500 : false),
  });
}
