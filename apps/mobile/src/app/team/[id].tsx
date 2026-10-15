import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Mascot } from '@/components/mascot';
import { api } from '@/lib/api';
import { type Assistant, queryClient, teamQuery, unwrap } from '@/lib/queries';

export default function AssistantSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: team } = useQuery(teamQuery);
  const assistant = team?.find((assistant) => assistant.id === id);
  if (!assistant) return null;
  return <RenameForm assistant={assistant} />;
}

function RenameForm({ assistant }: { assistant: Assistant }) {
  const { bottom } = useSafeAreaInsets();
  const [name, setName] = useState(assistant.name);
  const rename = useMutation({
    mutationFn: () => unwrap(api.team({ id: assistant.id }).patch({ name })),
    onSuccess: async () => {
      await queryClient.invalidateQueries(teamQuery);
      router.back();
    },
  });
  const canSave = !!name.trim() && name.trim() !== assistant.name;

  return (
    <View className="bg-card px-5 pt-6" style={{ paddingBottom: bottom + 20 }}>
      <View className="flex-row items-center gap-3">
        <Mascot mascot={assistant.mascot} size={40} />
        <View>
          <Text className="font-extrabold text-[19px] text-foreground">{assistant.name}</Text>
          <Text className="font-normal text-muted-foreground text-sm">{assistant.title}</Text>
        </View>
      </View>
      <Text className="mt-5 font-semibold text-[13px] text-muted-foreground">Nome</Text>
      <Field
        className="mt-1.5"
        accessibilityLabel="Nome do assistente"
        value={name}
        onChangeText={setName}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={() => canSave && !rename.isPending && rename.mutate()}
      />
      {rename.isError && (
        <Text selectable className="mt-2 font-normal text-destructive text-sm">
          Não conseguimos renomear. Tente de novo.
        </Text>
      )}
      <Button
        className="mt-4"
        label="Salvar"
        disabled={!canSave}
        loading={rename.isPending}
        onPress={() => rename.mutate()}
      />
    </View>
  );
}
