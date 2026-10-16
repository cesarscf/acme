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
    // A turn goes on when the app leaves the thread, so a reopened one polls until the team is done.
    refetchInterval: (query) => (query.state.data?.working ? 1500 : false),
  });
}
