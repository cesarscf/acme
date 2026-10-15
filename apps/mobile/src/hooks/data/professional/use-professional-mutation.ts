import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { professionalKeys } from './keys';
import type { Professional } from './use-professional-query';

type Changes = Partial<Pick<Professional, 'name' | 'trades' | 'workStyle'>>;

// Optimistic: onboarding screens read the Professional back right away (the Trades sheet on every tap).
export function useProfessionalMutation() {
  return useMutation({
    // One PATCH at a time, so quick taps reach the API in order.
    scope: { id: 'professional' },
    mutationFn: (changes: Changes) => unwrap(api.me.patch(changes)),
    onMutate: (changes) => {
      const previous = queryClient.getQueryData<Professional>(professionalKeys.me);
      queryClient.setQueryData<Professional>(professionalKeys.me, (me) => me && { ...me, ...changes });
      return { previous };
    },
    onError: (_error, _changes, context) => queryClient.setQueryData(professionalKeys.me, context?.previous),
  });
}
