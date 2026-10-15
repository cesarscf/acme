import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { professionalKeys } from './keys';

function getProfessional() {
  return unwrap(api.me.get());
}

export type Professional = Awaited<ReturnType<typeof getProfessional>>;
export type Trade = Professional['trades'][number];
export type WorkStyle = NonNullable<Professional['workStyle']>;

export function useProfessionalQuery() {
  return useQuery({ queryKey: professionalKeys.me, queryFn: getProfessional });
}
