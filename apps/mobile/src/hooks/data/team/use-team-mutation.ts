import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { teamKeys } from './keys';
import type { Role } from './use-team-query';

export function useTeamMutation() {
  return useMutation({
    mutationFn: (roles: Role[]) => unwrap(api.team.post({ roles })),
    // Not awaited: the ready screen must open before the root layout sees the Team and leaves onboarding.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}
