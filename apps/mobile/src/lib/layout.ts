import { useWindowDimensions } from 'react-native';

// The prototype is drawn on a 390pt-wide phone; decorative positions scale with the screen.
export function usePrototypeScale() {
  return useWindowDimensions().width / 390;
}
