import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { customerKeys } from './keys';

function getCustomerThread(id: string) {
  return unwrap(api.customers({ id }).thread.get());
}

export type CustomerThread = Awaited<ReturnType<typeof getCustomerThread>>;
export type ThreadItem = CustomerThread['items'][number];

export function useCustomerThreadQuery(id: string) {
  return useQuery({
    queryKey: customerKeys.thread(id),
    queryFn: () => getCustomerThread(id),
    // The team's turn goes on when the app leaves the thread; the Customer answers on WhatsApp at any time.
    refetchInterval: (query) => (query.state.data?.working ? 1500 : 5000),
  });
}
