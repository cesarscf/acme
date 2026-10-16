import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from '../conversation/keys';
import { customerKeys } from '../customers/keys';

function createWorkRecord(transcript: string, visitId?: string) {
  return unwrap(api['work-records'].post({ transcript, visitId }));
}

export type WorkRecord = Awaited<ReturnType<typeof createWorkRecord>>;

export function useCreateWorkRecordMutation(visitId?: string) {
  return useMutation({
    mutationFn: (transcript: string) => createWorkRecord(transcript, visitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      if (visitId) queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
