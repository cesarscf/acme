import { Pressable, Text, View } from 'react-native';
import type { CatalogEntry } from '@/hooks/data/catalog/use-catalog-query';
import { Icon } from './icons';
import { Mascot } from './mascot';

// A next step above the field, with the mascot of the Assistant who does it.
export function TeamAction({
  label,
  assistant,
  done,
  locked,
  onPress,
}: {
  label: string;
  assistant: { name: string; mascot: CatalogEntry['mascot'] };
  done: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`rounded-2xl border bg-card px-3.5 py-2.5 ${done ? 'border-accent' : 'border-border'} ${locked && !done ? 'opacity-50' : ''}`}
      style={{ borderCurve: 'continuous' }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, com a ${assistant.name}`}
      accessibilityState={{ disabled: locked, checked: done }}
      disabled={locked}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-1.5">
        {done && <Icon name="check" size={14} color="--color-primary" strokeWidth={2.6} />}
        <Text className="font-bold text-foreground text-sm">{label}</Text>
      </View>
      <View className="mt-1 flex-row items-center gap-[5px]">
        <Mascot mascot={assistant.mascot} size={14} />
        <Text className="font-normal text-muted-foreground text-xs">com a {assistant.name}</Text>
      </View>
    </Pressable>
  );
}
