import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from '@/components/mascot';
import { authClient } from '@/lib/auth-client';
import { firstName } from '@/lib/onboarding';
import { meQuery, queryClient, teamQuery } from '@/lib/queries';

export default function Home() {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useQuery(meQuery);
  const { data: team } = useQuery(teamQuery);
  const name = me && firstName(me.name);

  function signOut() {
    Alert.alert('Sair da conta?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await authClient.signOut();
          queryClient.clear();
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: top + 20 }}>
      <View className="flex-row items-center gap-3 px-5 pb-2">
        <Pressable
          className="size-10 items-center justify-center rounded-full border border-border active:bg-secondary"
          accessibilityRole="button"
          accessibilityLabel="Sua conta"
          onPress={signOut}
        >
          <Text className="font-bold text-muted-foreground text-sm">{name?.[0]?.toUpperCase()}</Text>
        </Pressable>
        <Text className="flex-1 font-extrabold text-[22px] text-foreground tracking-[-0.22px]">
          {name ? `Olá, ${name}` : 'Olá'}
        </Text>
      </View>
      <ScrollView
        className="mt-2.5 flex-1"
        contentContainerStyle={{ paddingBottom: bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {team?.map((assistant, index) => (
          <Link key={assistant.id} href={{ pathname: '/team/[id]', params: { id: assistant.id } }} asChild>
            <Pressable
              className="min-h-[68px] flex-row items-center gap-3.5 px-5 py-2.5 active:bg-secondary"
              accessibilityHint="Abre as opções do assistente"
            >
              <Mascot mascot={assistant.mascot} size={40} />
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-bold text-base text-foreground">{assistant.name}</Text>
                  {index === 0 && (
                    <Text className="h-[22px] overflow-hidden rounded-full bg-primary/10 px-2 font-bold text-[11.5px] text-foreground leading-[22px]">
                      Próximo
                    </Text>
                  )}
                </View>
                <Text numberOfLines={1} className="mt-0.5 font-semibold text-primary text-sm">
                  Combine comigo para eu começar
                </Text>
              </View>
              <View className="size-[9px] rounded-full bg-primary" />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}
