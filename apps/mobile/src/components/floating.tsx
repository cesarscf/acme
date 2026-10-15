import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

const bob = { '0%': { transform: [{ translateY: 0 }] }, '50%': { transform: [{ translateY: -12 }] } };

export function Floating({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      style={[
        style,
        !reducedMotion && {
          animationName: bob,
          animationDuration: '5.5s',
          animationDelay: `${delay}ms`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
