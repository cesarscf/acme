import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { idleTurn } from '@/lib/turn';
import { readTurn } from '../conversation/read-turn';
import { customerKeys } from './keys';

export function useCustomerConfirmationMutation(customerId: string) {
  const [turn, setTurn] = useState(idleTurn);
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ confirmationId, confirmed }: { confirmationId: string; confirmed: boolean }) =>
      readTurn(
        customerKeys.thread(customerId),
        api.customers({ id: customerId }).confirmations({ confirmationId }).post({ confirmed }),
        setTurn,
        setAnsweredBy,
      ),
  });
  return { ...mutation, draft: turn.draft, activity: turn.status, answeredBy };
}
