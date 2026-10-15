import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { professionalKeys } from './keys';

export function useAiConsentMutation() {
  return useMutation({
    mutationFn: () => unwrap(api.me['ai-consent'].post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: professionalKeys.me }),
  });
}
