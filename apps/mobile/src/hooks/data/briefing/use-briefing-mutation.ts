import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { teamKeys } from '../team/keys';
import { briefingKeys } from './keys';

export type Answer = { step: string; option: string } | { step: string; text: string };

function useRefreshingMutation<Variables, Result>(
  assistantId: string,
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: briefingKeys.detail(assistantId) }),
  });
}

// A chip or a free text answer; free text that does not fit the step comes back with understood false.
export function useAnswerMutation(assistantId: string) {
  return useRefreshingMutation(assistantId, (answer: Answer) =>
    unwrap(api.team({ id: assistantId }).briefing.answers.post(answer)),
  );
}

export function useSkipConnectMutation(assistantId: string) {
  return useRefreshingMutation(assistantId, () => unwrap(api.team({ id: assistantId }).briefing.connect.post()));
}

export function useAdjustMutation(assistantId: string) {
  return useRefreshingMutation(assistantId, (step: string) =>
    unwrap(api.team({ id: assistantId }).briefing.adjust.post({ step })),
  );
}

export function useApproveMutation(assistantId: string) {
  return useMutation({
    mutationFn: () => unwrap(api.team({ id: assistantId }).briefing.approve.post()),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: briefingKeys.detail(assistantId) }),
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
      ]),
  });
}

export function useUndoMutation(assistantId: string) {
  return useMutation({
    mutationFn: () => unwrap(api.team({ id: assistantId }).briefing.undo.post()),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: briefingKeys.detail(assistantId) }),
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
      ]),
  });
}
