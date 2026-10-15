import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { teamKeys } from './keys';

function getTeam() {
  return unwrap(api.team.get());
}

export type Assistant = Awaited<ReturnType<typeof getTeam>>[number];
export type Role = Assistant['role'];

export function useTeamQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: teamKeys.all, queryFn: getTeam, enabled });
}
