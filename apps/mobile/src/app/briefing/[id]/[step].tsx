import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuestionCard } from '@/components/briefing-cards';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { type Answer, useAnswerMutation } from '@/hooks/data/briefing/use-briefing-mutation';
import { type BriefingStep, useBriefingQuery } from '@/hooks/data/briefing/use-briefing-query';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';

// Changes one field of an approved Playbook, with the same chips and free text as the Briefing.
export default function PlaybookStepSheet() {
  const { id, step: key } = useLocalSearchParams<{ id: string; step: string }>();
  const { data: briefing } = useBriefingQuery(id);
  const step = briefing?.steps.find((step) => step.key === key);
  if (!step) return null;
  return <StepForm assistantId={id} step={step} />;
}

function StepForm({ assistantId, step }: { assistantId: string; step: BriefingStep }) {
  const { bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const answer = useAnswerMutation(assistantId);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<string | null>(null);

  function save(variables: Answer) {
    setReply(null);
    answer.mutate(variables, {
      onSuccess: (result) => (result.understood ? router.back() : setReply(result.reply)),
    });
  }

  function saveText() {
    const message = text.trim();
    if (!message || answer.isPending) return;
    // Free text goes to the AI, so it needs the consent like any real task.
    if (!me?.aiConsentedAt) {
      router.push('/ai-consent');
      return;
    }
    save({ step: step.key, text: message });
  }

  return (
    <View className="gap-3 bg-card px-5 pt-6" style={{ paddingBottom: bottom + 20 }}>
      <Text className="font-extrabold text-[19px] text-foreground">{step.label}</Text>
      <QuestionCard step={step} disabled={answer.isPending} onPick={(option) => save({ step: step.key, option })} />
      <Text className="mt-2 font-semibold text-[13px] text-muted-foreground">Ou escreva do seu jeito</Text>
      <Field
        accessibilityLabel="Resposta"
        value={text}
        onChangeText={setText}
        maxLength={1000}
        returnKeyType="send"
        onSubmitEditing={saveText}
      />
      {!!reply && (
        <Text selectable className="font-normal text-foreground text-sm">
          {reply}
        </Text>
      )}
      {answer.isError && (
        <Text selectable className="font-normal text-destructive text-sm">
          Não conseguimos salvar. Tente de novo.
        </Text>
      )}
      <Button label="Salvar" disabled={!text.trim()} loading={answer.isPending} onPress={saveText} />
    </View>
  );
}
