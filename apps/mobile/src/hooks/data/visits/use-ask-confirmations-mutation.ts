import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from '../conversation/keys';
import { customerKeys } from '../customers/keys';

// "Pedir confirmação" in Hoje: the Visits the card listed, asked all at once.
export function useAskConfirmationsMutation() {
  return useMutation({
    mutationFn: (visitIds: string[]) => unwrap(api.visits.confirmations.post({ visitIds })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
