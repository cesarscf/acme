import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { customerKeys } from './keys';

export function useCreateCustomerMutation() {
  return useMutation({
    mutationFn: (customer: { name: string; phoneNumber: string }) => unwrap(api.customers.post(customer)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
