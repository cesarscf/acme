import { Pressable, Text } from 'react-native';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  className = '',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      className={`h-[54px] items-center justify-center rounded-2xl bg-primary disabled:opacity-30 ${className}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
    >
      <Text className="font-bold text-base text-primary-foreground">{label}</Text>
    </Pressable>
  );
}
