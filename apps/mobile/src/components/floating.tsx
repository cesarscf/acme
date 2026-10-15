import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function Floating({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withDelay(
      delay,
      withRepeat(withTiming(-12, { duration: 2750, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay, offset]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
