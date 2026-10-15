import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { Sheet } from '@/components/sheet';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { firstName } from '@/lib/onboarding';
import { type Assistant, meQuery, queryClient, teamQuery, unwrap } from '@/lib/queries';

export default function Home() {
  const { top } = useSafeAreaInsets();
  const { data: me } = useQuery(meQuery);
  const { data: team } = useQuery(teamQuery);
  const [renaming, setRenaming] = useState<Assistant>();
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
          className="size-10 items-center justify-center rounded-full border border-border"
          accessibilityRole="button"
          accessibilityLabel="Sua conta"
          onPress={signOut}
        >
          <Text className="font-bold text-muted-foreground text-sm">{name?.[0]?.toUpperCase()}</Text>
        </Pressable>
        <Text className="flex-1 font-extrabold text-[22px] text-foreground">{name ? `Olá, ${name}` : 'Olá'}</Text>
      </View>
      <ScrollView className="mt-2.5 flex-1">
        {team?.map((assistant, index) => (
          <Pressable
            key={assistant.id}
            className="min-h-[68px] flex-row items-center gap-3.5 px-5 py-2.5 active:bg-secondary"
            accessibilityHint="Abre as opções do assistente"
            onPress={() => setRenaming(assistant)}
          >
            <Mascot mascot={assistant.mascot} size={40} />
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-bold text-base text-foreground">{assistant.name}</Text>
                {index === 0 && (
                  <Text className="overflow-hidden rounded-full bg-accent px-2 py-0.5 font-bold text-[11.5px] text-accent-foreground">
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
        ))}
      </ScrollView>
      <RenameSheet assistant={renaming} onClose={() => setRenaming(undefined)} />
    </View>
  );
}

function RenameSheet({ assistant, onClose }: { assistant?: Assistant; onClose: () => void }) {
  return (
    <Sheet open={!!assistant} onClose={onClose}>
      {assistant && <RenameForm key={assistant.id} assistant={assistant} onDone={onClose} />}
    </Sheet>
  );
}

function RenameForm({ assistant, onDone }: { assistant: Assistant; onDone: () => void }) {
  const [name, setName] = useState(assistant.name);
  const rename = useMutation({
    mutationFn: () => unwrap(api.team({ id: assistant.id }).patch({ name })),
    onSuccess: async () => {
      await queryClient.invalidateQueries(teamQuery);
      onDone();
    },
  });

  return (
    <View>
      <View className="flex-row items-center gap-3">
        <Mascot mascot={assistant.mascot} size={40} />
        <View>
          <Text className="font-extrabold text-[19px] text-foreground">{assistant.name}</Text>
          <Text className="text-muted-foreground text-sm">{assistant.title}</Text>
        </View>
      </View>
      <Text className="mt-5 font-semibold text-[13px] text-muted-foreground">Nome</Text>
      <TextInput
        className="mt-1.5 h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 text-base text-foreground"
        accessibilityLabel="Nome do assistente"
        value={name}
        onChangeText={setName}
        maxLength={40}
        onSubmitEditing={() => name.trim() && rename.mutate()}
      />
      {rename.isError && <Text className="mt-2 text-destructive">Não conseguimos renomear. Tente de novo.</Text>}
      <PrimaryButton
        className="mt-4"
        label="Salvar"
        disabled={!name.trim() || name.trim() === assistant.name || rename.isPending}
        onPress={() => rename.mutate()}
      />
    </View>
  );
}
