import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { readTurn } from '../conversation/read-turn';
import { customerKeys } from './keys';

export function useCustomerConfirmationMutation(customerId: string) {
  const [draft, setDraft] = useState('');
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ confirmationId, confirmed }: { confirmationId: string; confirmed: boolean }) =>
      readTurn(
        customerKeys.thread(customerId),
        api.customers({ id: customerId }).confirmations({ confirmationId }).post({ confirmed }),
        setDraft,
        setAnsweredBy,
      ),
  });
  return { ...mutation, draft, answeredBy };
}
