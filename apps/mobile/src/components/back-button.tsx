import { router } from 'expo-router';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

export function BackButton() {
  const color = useCSSVariable('--color-foreground') as string;

  return (
    <Pressable
      className="size-11 items-center justify-center rounded-full border border-border bg-card"
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      onPress={() => router.back()}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
        <Path d="M15 5l-7 7 7 7" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}
