import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { conversationKeys } from '../conversation/keys';
import { customerKeys } from '../customers/keys';

// Where the account goes: the Visit picked, a Customer picked, or (customer) what was written about a new one.
function createWorkRecord(variables: { transcript: string; visitId?: string; customerId?: string; customer?: string }) {
  return unwrap(api['work-records'].post(variables));
}

export type WorkRecord = Awaited<ReturnType<typeof createWorkRecord>>;

export function useCreateWorkRecordMutation() {
  return useMutation({
    mutationFn: createWorkRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
