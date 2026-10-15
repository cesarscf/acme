import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Icon } from './icons';

export function BackButton({ onPress = () => router.back() }: { onPress?: () => void }) {
  return (
    <Pressable
      className="size-11 items-center justify-center rounded-full border border-border bg-card active:bg-secondary"
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      onPress={onPress}
    >
      <Icon name="back" />
    </Pressable>
  );
}
