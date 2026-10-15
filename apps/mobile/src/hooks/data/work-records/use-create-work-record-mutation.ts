import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { workRecordKeys } from './keys';

export function useCreateWorkRecordMutation() {
  return useMutation({
    mutationFn: (transcript: string) => unwrap(api['work-records'].post({ transcript })),
    onSuccess: (workRecord) => {
      queryClient.setQueryData(workRecordKeys.detail(workRecord.id), workRecord);
      queryClient.invalidateQueries({ queryKey: workRecordKeys.list });
    },
  });
}
