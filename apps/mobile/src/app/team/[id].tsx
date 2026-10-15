import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaybookRow, TestPixCard } from '@/components/briefing-cards';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot';
import { useBriefingQuery } from '@/hooks/data/briefing/use-briefing-query';
import { useAssistantMutation } from '@/hooks/data/team/use-assistant-mutation';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';

export default function AssistantSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: team } = useTeamQuery();
  const assistant = team?.find((assistant) => assistant.id === id);
  if (!assistant) return null;
  return <RenameForm assistant={assistant} />;
}

function RenameForm({ assistant }: { assistant: Assistant }) {
  const { bottom } = useSafeAreaInsets();
  const [name, setName] = useState(assistant.name);
  const rename = useAssistantMutation(assistant.id);
  const canSave = !!name.trim() && name.trim() !== assistant.name;

  function save() {
    if (canSave && !rename.isPending) rename.mutate(name, { onSuccess: () => router.back() });
  }

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
        onSubmitEditing={save}
      />
      {rename.isError && (
        <Text selectable className="mt-2 font-normal text-destructive text-sm">
          Não conseguimos renomear. Tente de novo.
        </Text>
      )}
      <Button className="mt-4" label="Salvar" disabled={!canSave} loading={rename.isPending} onPress={save} />
      {assistant.hasBriefing && assistant.playbookStatus === 'approved' && <Playbook assistant={assistant} />}
    </View>
  );
}

function Playbook({ assistant }: { assistant: Assistant }) {
  const { data: briefing } = useBriefingQuery(assistant.id);
  if (!briefing?.playbook) return null;
  return (
    <View className="mt-6">
      <Text className="font-semibold text-[13px] text-muted-foreground">Ficha</Text>
      <View className="mt-1.5 overflow-hidden rounded-2xl border border-border" style={{ borderCurve: 'continuous' }}>
        {briefing.playbook.map((row, index) => {
          const content = (
            <View className={`flex-row items-center gap-2 px-4 py-3 ${index > 0 ? 'border-secondary border-t' : ''}`}>
              <View className="flex-1">
                <PlaybookRow row={row} />
              </View>
              {row.step && <Icon name="chevronRight" size={16} color="--color-muted-foreground" />}
            </View>
          );
          if (!row.step) return <View key={row.label}>{content}</View>;
          return (
            <Pressable
              key={row.label}
              className="active:bg-secondary"
              accessibilityRole="button"
              accessibilityHint="Muda este item da ficha"
              onPress={() =>
                router.push({ pathname: '/briefing/[id]/[step]', params: { id: assistant.id, step: row.step! } })
              }
            >
              {content}
            </Pressable>
          );
        })}
      </View>
      {briefing.testPix && (
        <View className="mt-3">
          <TestPixCard testPix={briefing.testPix} />
        </View>
      )}
    </View>
  );
}
