import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

export const queryClient = new QueryClient();

// React Native has no window focus: the app coming back refetches, and polling pauses while it is in the background.
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
