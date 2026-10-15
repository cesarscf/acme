import '../global.css';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { LoadError } from '@/components/load-error';
import { useTeamQuery } from '@/hooks/data/team/use-team-query';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Screens draw under the system bars and pad themselves with safe area insets. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        {/* Dark icons on the light screens; Android's default is light icons. */}
        <StatusBar style="dark" />
        <Routes />
      </KeyboardProvider>
    </QueryClientProvider>
  );
}

function Routes() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const { data: session, isPending } = authClient.useSession();
  const team = useTeamQuery({ enabled: !!session });
  const loading = (!fontsLoaded && !fontError) || isPending || (!!session && team.isPending);

  useEffect(() => {
    if (!loading) SplashScreen.hide();
  }, [loading]);

  if (loading) return null;
  if (session && team.isError) {
    return <LoadError message="Não conseguimos carregar a sua equipe." onRetry={() => team.refetch()} />;
  }
  // Onboarding ends when the Team exists; the ready screen stays reachable so it can show the new Team.
  const hasTeam = !!team.data?.length;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && hasTeam}>
        <Stack.Screen name="index" />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen
          name="ai-consent"
          options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: 'fitToContents' }}
        />
        <Stack.Screen
          name="team/[id]"
          options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: 'fitToContents' }}
        />
        <Stack.Screen
          name="briefing/[id]/[step]"
          options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: 'fitToContents' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !hasTeam}>
        <Stack.Screen name="onboarding/name" />
        <Stack.Screen
          name="onboarding/trades"
          options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.8] }}
        />
        <Stack.Screen name="onboarding/work-style" />
        <Stack.Screen name="onboarding/team" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="onboarding/ready" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify" />
      </Stack.Protected>
    </Stack>
  );
}
