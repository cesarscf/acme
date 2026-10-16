import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { customerKeys } from '../customers/keys';

export function useChooseCustomerMutation(id: string) {
  return useMutation({
    mutationFn: (customerId: string) => unwrap(api['work-records']({ id }).patch({ customerId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
