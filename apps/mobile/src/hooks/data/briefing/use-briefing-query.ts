import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { briefingKeys } from './keys';

function getBriefing(assistantId: string) {
  return unwrap(api.team({ id: assistantId }).briefing.get());
}

export type Briefing = Awaited<ReturnType<typeof getBriefing>>;
export type BriefingStep = Briefing['steps'][number];

export function useBriefingQuery(assistantId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: briefingKeys.detail(assistantId), queryFn: () => getBriefing(assistantId), enabled });
}
