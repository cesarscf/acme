import '../global.css';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { authClient } from '@/lib/auth-client';
import { queryClient, teamQuery } from '@/lib/queries';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes />
    </QueryClientProvider>
  );
}

function Routes() {
  const { data: session, isPending } = authClient.useSession();
  const team = useQuery({ ...teamQuery, enabled: !!session });
  if (isPending || (session && team.isPending)) return null;
  if (session && team.isError) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-6">
        <Text className="text-center text-foreground">Não conseguimos carregar a sua equipe.</Text>
        <PrimaryButton label="Tentar de novo" onPress={() => team.refetch()} />
      </View>
    );
  }
  // Onboarding ends when the Team exists; the ready screen stays reachable so it can show the new Team.
  const hasTeam = !!team.data?.length;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && hasTeam}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !hasTeam}>
        <Stack.Screen name="onboarding/name" />
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
