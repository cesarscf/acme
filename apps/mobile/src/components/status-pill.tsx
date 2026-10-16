import { Text } from 'react-native';

export type Status = { label: string; tone: 'ok' | 'wait' | 'none' | 'sent' };

const tones = {
  ok: 'bg-accent text-accent-foreground',
  wait: 'bg-warning text-warning-foreground',
  none: 'bg-secondary text-muted-foreground',
  sent: 'bg-info text-info-foreground',
} as const;

export function StatusPill({ status }: { status: Status }) {
  return (
    <Text
      numberOfLines={1}
      className={`h-[22px] shrink-0 overflow-hidden rounded-full px-2 font-bold text-[11.5px] leading-[22px] ${tones[status.tone]}`}
    >
      {status.label}
    </Text>
  );
}
