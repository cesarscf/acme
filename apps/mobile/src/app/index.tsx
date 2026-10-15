import { Link } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot';
import { useSignOutMutation } from '@/hooks/data/auth/use-sign-out-mutation';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { useTeamQuery } from '@/hooks/data/team/use-team-query';
import { firstName } from '@/lib/onboarding';

export default function Home() {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const { data: team } = useTeamQuery();
  const signOut = useSignOutMutation();
  const name = me && firstName(me.name);
  const next = team?.find((assistant) => assistant.playbookStatus === 'draft');

  function confirmSignOut() {
    Alert.alert('Sair da conta?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => signOut.mutate(),
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
          onPress={confirmSignOut}
        >
          <Text className="font-bold text-muted-foreground text-sm">{name?.[0]?.toUpperCase()}</Text>
        </Pressable>
        <Text className="flex-1 font-extrabold text-[22px] text-foreground tracking-[-0.22px]">
          {name ? `Olá, ${name}` : 'Olá'}
        </Text>
      </View>
      <ScrollView
        className="mt-2.5 flex-1"
        contentContainerStyle={{ paddingBottom: bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {team?.map((assistant) => (
          <Link key={assistant.id} href={{ pathname: '/conversation/[id]', params: { id: assistant.id } }} asChild>
            <Pressable
              className="min-h-[68px] flex-row items-center gap-3.5 px-5 py-2.5 active:bg-secondary"
              accessibilityHint="Abre a conversa"
            >
              <Mascot mascot={assistant.mascot} size={40} />
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-bold text-base text-foreground">{assistant.name}</Text>
                  {assistant.id === next?.id && (
                    <Text className="h-[22px] overflow-hidden rounded-full bg-primary/10 px-2 font-bold text-[11.5px] text-foreground leading-[22px]">
                      Próximo
                    </Text>
                  )}
                </View>
                {assistant.playbookStatus === 'approved' ? (
                  <Text numberOfLines={1} className="mt-0.5 font-normal text-muted-foreground text-sm">
                    {assistant.title} · {assistant.tagline}
                  </Text>
                ) : (
                  <Text numberOfLines={1} className="mt-0.5 font-semibold text-primary text-sm">
                    Combine comigo para eu começar
                  </Text>
                )}
              </View>
              {assistant.playbookStatus === 'draft' && <View className="size-[9px] rounded-full bg-primary" />}
            </Pressable>
          </Link>
        ))}
        <Link href="/customers" asChild>
          <Pressable
            className="mt-2 min-h-[56px] flex-row items-center gap-3.5 border-border border-t px-5 py-2.5 active:bg-secondary"
            accessibilityHint="Abre a lista de clientes"
          >
            <Text className="flex-1 font-bold text-base text-foreground">Clientes</Text>
            <Icon name="chevronRight" size={18} color="--color-muted-foreground" />
          </Pressable>
        </Link>
      </ScrollView>
      <View className="absolute inset-x-0 items-center" style={{ bottom: bottom + 24 }} pointerEvents="box-none">
        <Link href="/work-records/new" asChild>
          <Pressable
            className="h-14 flex-row items-center gap-2.5 rounded-full bg-primary px-[26px] active:opacity-90"
            style={{ boxShadow: '0 10px 24px rgba(14,30,24,0.22)' }}
            accessibilityRole="button"
            accessibilityHint="Conte o que fez numa visita"
          >
            <Icon name="mic" size={20} color="--color-primary-foreground" />
            <Text className="font-bold text-base text-primary-foreground">Registrar serviço</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
