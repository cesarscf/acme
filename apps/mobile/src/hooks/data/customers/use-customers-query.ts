import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { customerKeys } from './keys';

function getCustomers() {
  return unwrap(api.customers.get());
}

export type Customer = Awaited<ReturnType<typeof getCustomers>>[number];

export function useCustomersQuery() {
  return useQuery({ queryKey: customerKeys.all, queryFn: getCustomers });
}
