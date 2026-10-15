import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, type TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { SystemLine } from '@/components/briefing-cards';
import { BirthLine, BriefingProgress, BriefingThread } from '@/components/briefing-thread';
import { Notice, ProfessionalBubble, Reply } from '@/components/chat-messages';
import { Composer } from '@/components/composer';
import { ConfirmationCard } from '@/components/confirmation-card';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { Mascot } from '@/components/mascot';
import { OptionRow } from '@/components/option-row';
import { type Answer, useAnswerMutation } from '@/hooks/data/briefing/use-briefing-mutation';
import { type Briefing, useBriefingQuery } from '@/hooks/data/briefing/use-briefing-query';
import { useConfirmationMutation } from '@/hooks/data/conversation/use-confirmation-mutation';
import {
  type Conversation,
  type ConversationItem,
  useConversationQuery,
} from '@/hooks/data/conversation/use-conversation-query';
import { useSendMessageMutation } from '@/hooks/data/conversation/use-send-message-mutation';
import { useSuggestionMutation } from '@/hooks/data/conversation/use-suggestion-mutation';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';

type Suggestion = Extract<ConversationItem, { type: 'suggestion' }>;
type BookVisit = Extract<Suggestion, { action: 'book_visit' }>;
// What the Professional tapped before the AI consent sheet, done on the way back if allowed.
type AfterConsent =
  | { type: 'send'; message: string }
  | { type: 'accept'; suggestion: BookVisit }
  | { type: 'record'; visitId: string };

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: team } = useTeamQuery();
  const assistant = team?.find((assistant) => assistant.id === id);
  const conversation = useConversationQuery(id);
  const briefing = useBriefingQuery(id, { enabled: !!assistant?.hasBriefing });

  if (conversation.isError || briefing.isError) {
    return (
      <LoadError
        message="Não conseguimos carregar a conversa."
        onRetry={() => (conversation.isError ? conversation.refetch() : briefing.refetch())}
      />
    );
  }
  if (!assistant || !conversation.data || (assistant.hasBriefing && !briefing.data)) {
    return <View className="flex-1 bg-background" />;
  }
  return <Chat assistant={assistant} conversation={conversation.data} briefing={briefing.data ?? null} />;
}

function Chat({
  assistant,
  conversation,
  briefing,
}: {
  assistant: Assistant;
  conversation: Conversation;
  briefing: Briefing | null;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const send = useSendMessageMutation(assistant.id);
  const decide = useConfirmationMutation(assistant.id);
  const answer = useAnswerMutation(assistant.id);
  const suggest = useSuggestionMutation(assistant.id);
  const [misunderstood, setMisunderstood] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const afterConsent = useRef<AfterConsent | null>(null);
  const scroll = useRef<ScrollView>(null);

  // While the Briefing has a question open, what the Professional types answers it.
  const step = briefing?.status === 'draft' ? (briefing.steps.find((step) => !step.answer) ?? null) : null;
  const reviewing = briefing?.status === 'draft' && !step;
  const interpreting = answer.isPending && !!answer.variables && 'text' in answer.variables;
  const working = send.isPending || decide.isPending || suggest.isPending || conversation.working || interpreting;
  const draft = send.draft || decide.draft || suggest.draft;
  const awaiting = conversation.items.some((item) => item.type === 'confirmation' && item.status === 'pending');
  const status = working
    ? 'Trabalhando…'
    : awaiting || assistant.playbookStatus !== 'approved'
      ? 'Esperando você'
      : assistant.title;
  const failed = (send.isError || decide.isError || answer.isError || suggest.isError) && !working;
  const canSend = !!text.trim() && !working && !answer.isPending && !reviewing;

  function submit() {
    if (canSend) sendMessage(text.trim());
  }

  function sendMessage(message: string) {
    // The AI consent sheet comes up on the first real task, then the message goes out on its own.
    if (!me?.aiConsentedAt && (!step || step.usesAi)) {
      afterConsent.current = { type: 'send', message };
      router.push('/ai-consent');
      return;
    }
    setText('');
    if (step) {
      answerStep({ step: step.key, text: message });
      return;
    }
    send.mutate(message);
  }

  function answerSuggestion(suggestion: BookVisit, accepted: boolean) {
    if (accepted && !me?.aiConsentedAt) {
      afterConsent.current = { type: 'accept', suggestion };
      router.push('/ai-consent');
      return;
    }
    suggest.mutate({ suggestionId: suggestion.id, accepted, message: suggestion.message });
  }

  // The same recording as the home's "Registrar serviço", about this Visit.
  function recordWork(visitId: string) {
    if (!me?.aiConsentedAt) {
      afterConsent.current = { type: 'record', visitId };
      router.push({ pathname: '/ai-consent', params: { purpose: 'recording' } });
      return;
    }
    router.push({ pathname: '/work-records/new', params: { visitId } });
  }

  function answerStep(variables: Answer) {
    setMisunderstood(null);
    answer.mutate(variables, { onSuccess: (result) => setMisunderstood(result.understood ? null : result.reply) });
  }

  // Back from the consent sheet: do what was tapped if the Professional allowed, forget it if not.
  useFocusEffect(
    useCallback(() => {
      const pending = afterConsent.current;
      if (!pending) return;
      afterConsent.current = null;
      if (!me?.aiConsentedAt) return;
      if (pending.type === 'send') sendMessage(pending.message);
      else if (pending.type === 'accept') answerSuggestion(pending.suggestion, true);
      else recordWork(pending.visitId);
    }, [me?.aiConsentedAt, sendMessage, answerSuggestion, recordWork]),
  );

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <View className="flex-row items-center gap-2.5 px-4 pb-2.5" style={{ paddingTop: top + 12 }}>
        <BackButton />
        <Link href={{ pathname: '/team/[id]', params: { id: assistant.id } }} asChild>
          <Pressable
            className="min-w-0 flex-row items-center gap-2 rounded-full border border-border bg-card py-[5px] pr-3.5 pl-1.5 active:bg-secondary"
            accessibilityHint="Abre as opções do assistente"
          >
            <Mascot mascot={assistant.mascot} size={24} />
            <View className="min-w-0">
              <Text className="font-bold text-[14.5px] text-foreground leading-[18px]">{assistant.name}</Text>
              <View className="flex-row items-center gap-[5px]">
                {working && <View className="size-1.5 rounded-full bg-primary" />}
                <Text className="font-normal text-[11.5px] text-muted-foreground leading-[15px]">{status}</Text>
              </View>
            </View>
          </Pressable>
        </Link>
      </View>

      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-[18px] pt-2 pb-4"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <BirthLine assistant={assistant} />
        {briefing && (
          <BriefingThread
            assistant={assistant}
            briefing={briefing}
            step={step}
            busy={working || answer.isPending}
            answering={interpreting ? (answer.variables as { text: string }).text : null}
            misunderstood={misunderstood}
            onPick={(option) => step && answerStep({ step: step.key, option })}
            onOther={() => input.current?.focus()}
          />
        )}
        {conversation.items.map((item) =>
          item.type === 'professional' ? (
            <ProfessionalBubble key={item.id} text={item.text} />
          ) : item.type === 'assistant' ? (
            <Reply key={item.id} text={item.text} />
          ) : item.type === 'notice' ? (
            <Notice key={item.id} text={item.text} />
          ) : item.type === 'suggestion' ? (
            <SuggestionCard
              key={`suggestion-${item.id}`}
              suggestion={item}
              disabled={working}
              onAnswer={(accepted) => item.action === 'book_visit' && answerSuggestion(item, accepted)}
              onRecord={() => recordWork(item.id)}
            />
          ) : (
            <ConfirmationCard
              key={item.id}
              confirmation={item}
              disabled={working}
              onDecide={(confirmed) => decide.mutate({ confirmationId: item.id, confirmed })}
            />
          ),
        )}
        {!!draft && <Reply text={draft} />}
        {working && !draft && <Thinking assistant={assistant} />}
        {failed && (
          <Text selectable className="font-normal text-destructive text-sm">
            Não consegui responder agora. Tente de novo.
          </Text>
        )}
      </ScrollView>

      <View className="px-3" style={{ paddingBottom: bottom + 10 }}>
        <Composer
          inputRef={input}
          value={text}
          onChangeText={setText}
          editable={!reviewing}
          placeholder={
            step
              ? step.options.length
                ? 'Responda aqui ou escolha uma opção acima'
                : 'Responda aqui'
              : reviewing
                ? 'Confira a ficha acima'
                : working
                  ? 'Escreva uma correção ou o próximo pedido'
                  : `Escreva para ${assistant.name}`
          }
          canSend={canSend}
          onSend={submit}
          onMention={step || reviewing ? undefined : (message) => !working && sendMessage(message)}
          canListen={!!me?.aiConsentedAt}
          onListenBlocked={() => router.push('/ai-consent')}
          drawer={
            briefing?.status === 'draft' && <BriefingProgress assistant={assistant} briefing={briefing} step={step} />
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// A handoff between Assistants, as the prototype's question cards: one tap does it, nothing happens on its own.
function SuggestionCard({
  suggestion,
  disabled,
  onAnswer,
  onRecord,
}: {
  suggestion: Suggestion;
  disabled: boolean;
  onAnswer: (accepted: boolean) => void;
  onRecord: () => void;
}) {
  if (suggestion.action === 'book_visit' && suggestion.answer) {
    return (
      <View className="gap-3">
        <Reply text={suggestion.question} />
        {suggestion.answer === 'dismissed' && <ProfessionalBubble text="Agora não" />}
      </View>
    );
  }
  if (suggestion.action === 'record_work' && suggestion.workRecordId) {
    return (
      <View className="gap-3">
        <Reply text={suggestion.question} />
        <SystemLine>
          <Icon name="check" size={14} color="--color-primary" strokeWidth={2.4} />
          <Text className="font-normal text-[12.5px] text-muted-foreground">Serviço registrado</Text>
        </SystemLine>
      </View>
    );
  }
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      <Text className="px-3.5 pb-3 font-bold text-[15px] text-foreground leading-[21px]">{suggestion.question}</Text>
      {suggestion.action === 'book_visit' ? (
        <>
          <OptionRow letter="A" label="Marcar a visita" strong disabled={disabled} onPress={() => onAnswer(true)} />
          <OptionRow letter="B" label="Agora não" disabled={disabled} onPress={() => onAnswer(false)} />
        </>
      ) : (
        <OptionRow
          letter="A"
          label="Registrar serviço"
          hint="Conte o que fez. A equipe cuida do resto."
          strong
          disabled={disabled}
          onPress={onRecord}
        />
      )}
    </View>
  );
}

function Thinking({ assistant }: { assistant: Assistant }) {
  return (
    <View className="flex-row items-center gap-2.5" accessibilityLabel={`${assistant.name} está pensando`}>
      <Animated.View
        style={{
          animationName: { from: { transform: [{ scale: 0.92 }] }, to: { transform: [{ scale: 1.06 }] } },
          animationDuration: '700ms',
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
          animationTimingFunction: 'ease-in-out',
        }}
      >
        <Mascot mascot={assistant.mascot} size={22} />
      </Animated.View>
      <Text className="font-normal text-muted-foreground text-sm">Pensando</Text>
    </View>
  );
}
