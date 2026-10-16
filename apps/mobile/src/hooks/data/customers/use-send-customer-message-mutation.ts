import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { readTurn } from '../conversation/read-turn';
import { customerKeys } from './keys';
import type { CustomerThread } from './use-customer-thread-query';

export function useSendCustomerMessageMutation(customerId: string) {
  const [draft, setDraft] = useState('');
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (text: string) =>
      readTurn(
        customerKeys.thread(customerId),
        api.customers({ id: customerId }).messages.post({ text }),
        setDraft,
        setAnsweredBy,
      ),
    onMutate: async (text) => {
      setAnsweredBy(null);
      await queryClient.cancelQueries({ queryKey: customerKeys.thread(customerId) });
      queryClient.setQueryData<CustomerThread>(
        customerKeys.thread(customerId),
        (thread) =>
          thread && {
            ...thread,
            items: [...thread.items, { id: `sending-${Date.now()}`, type: 'professional', text, at: new Date() }],
          },
      );
    },
  });
  return { ...mutation, draft, answeredBy };
}
