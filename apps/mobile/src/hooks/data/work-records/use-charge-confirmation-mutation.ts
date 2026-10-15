import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { workRecordKeys } from './keys';

// "Recebi" or "Não caiu" after the Customer tapped "Já paguei".
export function useChargeConfirmationMutation(id: string) {
  return useMutation({
    mutationFn: (received: boolean) => unwrap(api['work-records']({ id }).charge.confirmation.post({ received })),
    onSuccess: (workRecord) => {
      queryClient.setQueryData(workRecordKeys.detail(id), workRecord);
      queryClient.invalidateQueries({ queryKey: workRecordKeys.list });
    },
  });
}
