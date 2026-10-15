import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  useAdjustMutation,
  useApproveMutation,
  useSkipConnectMutation,
  useUndoMutation,
} from '@/hooks/data/briefing/use-briefing-mutation';
import type { Briefing } from '@/hooks/data/briefing/use-briefing-query';
import type { Assistant } from '@/hooks/data/team/use-team-query';
import { AdjustCard, ConnectCard, PlaybookCard, QuestionCard, SystemLine, TestPixCard } from './briefing-cards';
import { ProfessionalBubble, Reply } from './chat-messages';
import { Mascot } from './mascot';

const connectSkipped = 'Tudo bem, conecto depois. Enquanto isso, vamos combinar o resto.';

export function BriefingThread({
  assistant,
  briefing,
  step,
  busy,
  answering,
  misunderstood,
  onPick,
  onOther,
}: {
  assistant: Assistant;
  briefing: Briefing;
  step: Briefing['steps'][number] | null;
  busy: boolean;
  answering: string | null;
  misunderstood: string | null;
  onPick: (option: string) => void;
  onOther: () => void;
}) {
  const skip = useSkipConnectMutation(assistant.id);
  const adjust = useAdjustMutation(assistant.id);
  const approve = useApproveMutation(assistant.id);
  const undo = useUndoMutation(assistant.id);
  const [adjusting, setAdjusting] = useState(false);
  const disabled = busy || skip.isPending || adjust.isPending || approve.isPending || undo.isPending;
  const approved = briefing.status === 'approved';

  // Answered steps up to the open one; Ajustar reopens a step and hides the ones after it until it is answered again.
  const visibleSteps = step ? briefing.steps.slice(0, briefing.steps.indexOf(step) + 1) : briefing.steps;
  const routines = briefing.playbook?.flatMap((row) => (row.routine ? [row.routine] : [])) ?? [];
  const intros = [connectSkipped, ...visibleSteps.map((visible) => visible.answer?.ack ?? '')];

  return (
    <>
      <SystemLine>
        <Mascot mascot={assistant.mascot} size={16} />
        <Text className="font-normal text-[12.5px] text-muted-foreground">
          <Text className="font-bold">{assistant.name}</Text> nasceu neste chat
        </Text>
      </SystemLine>
      <Reply text={briefing.greeting} />
      <ConnectCard
        connect={briefing.connect}
        active={!approved && !briefing.connect.skipped}
        disabled={disabled}
        onSkip={() => skip.mutate()}
      />
      {briefing.connect.skipped && (
        <>
          <ProfessionalBubble text="Agora não" />
          {visibleSteps.map((shownStep, index) => {
            const intro = [intros[index], shownStep.pre].filter(Boolean).join('\n\n');
            return shownStep.answer ? (
              <View key={shownStep.key} className="gap-3">
                <Reply text={`${intro}\n\n${shownStep.question}`} />
                <ProfessionalBubble text={shownStep.answer.said} />
              </View>
            ) : (
              <View key={shownStep.key} className="gap-3">
                {shownStep.options.length ? (
                  <>
                    <Reply text={intro} />
                    <QuestionCard step={shownStep} disabled={disabled} onPick={onPick} onOther={onOther} />
                  </>
                ) : (
                  <Reply text={`${intro}\n\n${shownStep.question}`} />
                )}
                {!!answering && <ProfessionalBubble text={answering} />}
                {!!misunderstood && !answering && <Reply text={misunderstood} />}
              </View>
            );
          })}
          {!step && briefing.playbook && (
            <>
              <Reply text={`${intros.at(-1)}\n\nConfere se eu entendi direito:`} />
              {briefing.testPix && !approved && <TestPixCard testPix={briefing.testPix} />}
              <PlaybookCard
                title={`Ficha de ${assistant.name}`}
                subtitle={assistant.title}
                playbook={briefing.playbook}
                approved={approved}
                disabled={disabled || adjusting}
                onAdjust={() => setAdjusting(true)}
                onApprove={() => approve.mutate()}
                onOpen={() => router.push({ pathname: '/team/[id]', params: { id: assistant.id } })}
              />
              {adjusting && !approved && (
                <AdjustCard
                  playbook={briefing.playbook}
                  disabled={disabled}
                  onPick={(picked) => adjust.mutate(picked, { onSuccess: () => setAdjusting(false) })}
                  onCancel={() => setAdjusting(false)}
                />
              )}
              {approved && (
                <>
                  <SystemLine>
                    <Text className="font-normal text-[12.5px] text-muted-foreground">
                      {routines.length ? `Rotina criada: ${routines.join(', ')}` : 'Ficha combinada'} ·
                    </Text>
                    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => undo.mutate()}>
                      <Text className={`font-bold text-[12.5px] text-primary ${disabled ? 'opacity-50' : ''}`}>
                        Desfazer
                      </Text>
                    </Pressable>
                  </SystemLine>
                  <Reply text={briefing.done} />
                </>
              )}
            </>
          )}
        </>
      )}
      {(skip.isError || adjust.isError || approve.isError || undo.isError) && (
        <Text selectable className="font-normal text-destructive text-sm">
          Não consegui salvar. Tente de novo.
        </Text>
      )}
    </>
  );
}

export function BriefingProgress({
  assistant,
  briefing,
  step,
}: {
  assistant: Assistant;
  briefing: Briefing;
  step: Briefing['steps'][number] | null;
}) {
  const total = briefing.steps.length + 1;
  const position = !briefing.connect.skipped ? 1 : step ? briefing.steps.indexOf(step) + 2 : null;
  return (
    <Text className="px-2 pb-2 font-semibold text-[12.5px] text-muted-foreground">
      {position
        ? `Combinando a função de ${assistant.name} · ${position} de ${total}`
        : 'Tudo combinado. Confere a ficha.'}
    </Text>
  );
}
