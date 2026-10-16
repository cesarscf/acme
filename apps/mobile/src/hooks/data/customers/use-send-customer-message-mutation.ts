import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { idleTurn } from '@/lib/turn';
import { readTurn } from '../conversation/read-turn';
import type { Assistant } from '../team/use-team-query';
import { customerKeys } from './keys';
import type { CustomerThread } from './use-customer-thread-query';

// An action above the field, or an answer to a question, names the Role that does it; free text goes to whoever fits.
type Message = { text: string; role?: Assistant['role'] };

export function useSendCustomerMessageMutation(customerId: string) {
  const [turn, setTurn] = useState(idleTurn);
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ text, role }: Message) =>
      readTurn(
        customerKeys.thread(customerId),
        api.customers({ id: customerId }).messages.post({ text, role }),
        setTurn,
        setAnsweredBy,
      ),
    onMutate: async ({ text }) => {
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
  return { ...mutation, draft: turn.draft, activity: turn.status, answeredBy };
}
