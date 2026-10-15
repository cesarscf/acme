import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { teamKeys } from './keys';

export function useAssistantMutation(id: string) {
  return useMutation({
    mutationFn: (name: string) => unwrap(api.team({ id }).patch({ name })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}
