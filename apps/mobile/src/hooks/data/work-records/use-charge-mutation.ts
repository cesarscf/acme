import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { workRecordKeys } from './keys';

// Confirmar on "Cobrar no Pix": the Charge is made and the Pix goes to the Customer's WhatsApp.
export function useChargeMutation(id: string) {
  return useMutation({
    mutationFn: () => unwrap(api['work-records']({ id }).charge.post()),
    onSuccess: (workRecord) => {
      queryClient.setQueryData(workRecordKeys.detail(id), workRecord);
      queryClient.invalidateQueries({ queryKey: workRecordKeys.list });
    },
  });
}
