import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from '../conversation/keys';
import { workRecordKeys } from './keys';

// With a visitId, the WorkRecord comes from that ended Visit's "Registrar serviço".
export function useCreateWorkRecordMutation(visitId?: string) {
  return useMutation({
    mutationFn: (transcript: string) => unwrap(api['work-records'].post({ transcript, visitId })),
    onSuccess: (workRecord) => {
      queryClient.setQueryData(workRecordKeys.detail(workRecord.id), workRecord);
      queryClient.invalidateQueries({ queryKey: workRecordKeys.list });
      if (visitId) queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
