import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { customerKeys } from '../customers/keys';

export function useWorkRecordMessageMutation(id: string) {
  return useMutation({
    mutationFn: (text: string) => unwrap(api['work-records']({ id }).messages.post({ text })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
