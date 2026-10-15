import * as Haptics from 'expo-haptics';

// iOS only: most Android hardware gives a weak buzz instead of a selection tick.
export function selectionFeedback() {
  if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
}
