import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { customerKeys } from './keys';

function getCustomers(query: string) {
  return unwrap(api.customers.get({ query: { query } }));
}

export type CustomerSection = Awaited<ReturnType<typeof getCustomers>>['sections'][number];
export type CustomerRow = CustomerSection['rows'][number];

export function useCustomersQuery(query: string) {
  return useQuery({
    queryKey: customerKeys.list(query),
    queryFn: () => getCustomers(query),
    // The list keeps showing while the next search loads, so typing does not blink it empty.
    placeholderData: keepPreviousData,
  });
}
