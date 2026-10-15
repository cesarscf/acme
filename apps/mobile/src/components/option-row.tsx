import { Pressable, Text, View } from 'react-native';
import { Icon } from './icons';

export function OptionRow({
  letter,
  label,
  hint,
  badge,
  strong,
  disabled,
  onPress,
}: {
  letter: string;
  label: string;
  hint?: string | null;
  badge?: string;
  strong?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`min-h-[52px] flex-row items-center gap-3 border-secondary border-t px-3.5 py-2 active:bg-secondary ${disabled ? 'opacity-50' : ''}`}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityHint={hint ?? undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      <View className="size-7 items-center justify-center rounded-lg bg-secondary">
        <Text className="font-bold text-[13px] text-muted-foreground">{letter}</Text>
      </View>
      <View className="flex-1">
        <Text className={`text-[14.5px] text-foreground ${strong ? 'font-semibold' : 'font-medium'}`}>{label}</Text>
        {!!hint && <Text className="mt-px font-normal text-[12.5px] text-muted-foreground">{hint}</Text>}
      </View>
      {badge ? (
        <Text className="h-[22px] overflow-hidden rounded-full bg-secondary px-2 font-semibold text-[11.5px] text-muted-foreground leading-[22px]">
          {badge}
        </Text>
      ) : (
        <Icon name="chevronRight" size={16} color="--color-muted-foreground" />
      )}
    </Pressable>
  );
}
