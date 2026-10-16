import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from '../conversation/keys';
import { customerKeys } from '../customers/keys';
import { workRecordKeys } from './keys';

export function useCreateWorkRecordMutation(visitId?: string) {
  return useMutation({
    mutationFn: (transcript: string) => unwrap(api['work-records'].post({ transcript, visitId })),
    onSuccess: (workRecord) => {
      queryClient.setQueryData(workRecordKeys.detail(workRecord.id), workRecord);
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      if (visitId) queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
