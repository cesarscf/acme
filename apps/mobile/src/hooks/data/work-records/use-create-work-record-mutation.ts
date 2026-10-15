import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export type NewWorkRecord = Parameters<(typeof api)['work-records']['post']>[0];

export function useCreateWorkRecordMutation() {
  return useMutation({ mutationFn: (record: NewWorkRecord) => unwrap(api['work-records'].post(record)) });
}
