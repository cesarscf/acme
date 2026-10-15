import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { workRecordKeys } from './keys';

function getWorkRecord(id: string) {
  return unwrap(api['work-records']({ id }).get());
}

export type WorkRecord = Awaited<ReturnType<typeof getWorkRecord>>;

export function useWorkRecordQuery(id: string) {
  return useQuery({ queryKey: workRecordKeys.detail(id), queryFn: () => getWorkRecord(id) });
}
