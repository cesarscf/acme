import '../global.css';
import { Stack } from 'expo-router';
import { authClient } from '@/lib/auth-client';

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify" />
      </Stack.Protected>
    </Stack>
  );
}
