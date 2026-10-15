import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Icon } from './icons';

export function BackButton() {
  return (
    <Pressable
      className="size-11 items-center justify-center rounded-full border border-border bg-card active:bg-secondary"
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      onPress={() => router.back()}
    >
      <Icon name="back" />
    </Pressable>
  );
}
