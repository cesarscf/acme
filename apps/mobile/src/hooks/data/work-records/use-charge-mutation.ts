import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { customerKeys } from '../customers/keys';
import { workRecordKeys } from './keys';

export function useChargeMutation(id: string) {
  return useMutation({
    mutationFn: () => unwrap(api['work-records']({ id }).charge.post()),
    onSuccess: (workRecord) => {
      queryClient.setQueryData(workRecordKeys.detail(id), workRecord);
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}
