import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { workRecordKeys } from './keys';

function getWorkRecordForm() {
  return unwrap(api['work-records'].new.get());
}

export type WorkRecordForm = Awaited<ReturnType<typeof getWorkRecordForm>>;
export type PaymentMethod = WorkRecordForm['paymentMethods']['default'];

export function useWorkRecordFormQuery() {
  return useQuery({ queryKey: workRecordKeys.form, queryFn: getWorkRecordForm });
}
