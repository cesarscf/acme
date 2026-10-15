import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { workRecordKeys } from './keys';

function getWorkRecords() {
  return unwrap(api['work-records'].get());
}

export type WorkRecordRow = Awaited<ReturnType<typeof getWorkRecords>>[number];

export function useWorkRecordsQuery() {
  return useQuery({ queryKey: workRecordKeys.list, queryFn: getWorkRecords });
}
