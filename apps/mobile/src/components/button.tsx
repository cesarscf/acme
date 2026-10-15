import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

const variants = {
  primary: { box: 'bg-primary', label: 'text-primary-foreground', spinner: '--color-primary-foreground' },
  glass: { box: 'bg-background/10', label: 'text-background', spinner: '--color-background' },
  link: { box: 'h-11 self-center px-3', label: 'text-[15px] text-foreground', spinner: '--color-foreground' },
  secondary: { box: 'border border-input bg-card', label: 'text-foreground', spinner: '--color-foreground' },
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  className = '',
}: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof variants;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const { box, label: labelClass, spinner } = variants[variant];
  const spinnerColor = useCSSVariable(spinner) as string;

  return (
    <Pressable
      className={className}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
    >
      <Animated.View
        className={`items-center justify-center rounded-2xl ${variant === 'link' ? '' : 'h-[54px]'} ${box} ${disabled ? 'opacity-30' : ''}`}
        style={{
          borderCurve: 'continuous',
          transform: [{ scale: pressed && !disabled && !loading ? 0.97 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: '120ms',
          transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
        }}
      >
        {loading ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <Text className={`font-bold text-base ${labelClass}`}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
