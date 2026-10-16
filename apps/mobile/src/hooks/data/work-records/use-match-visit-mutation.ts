import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

function matchVisit(variables: { transcript: string; visitId?: string }) {
  return unwrap(api['work-records'].match.post(variables));
}

export type VisitMatch = Awaited<ReturnType<typeof matchVisit>>;

// Which Visit the account is about; nothing is saved until the Professional picks one.
export function useMatchVisitMutation() {
  return useMutation({ mutationFn: matchVisit });
}
