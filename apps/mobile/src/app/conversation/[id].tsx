import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { BackButton } from '@/components/back-button';
import { ConfirmationCard } from '@/components/confirmation-card';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { Mascot } from '@/components/mascot';
import { useConfirmationMutation } from '@/hooks/data/conversation/use-confirmation-mutation';
import { type Conversation, useConversationQuery } from '@/hooks/data/conversation/use-conversation-query';
import { useSendMessageMutation } from '@/hooks/data/conversation/use-send-message-mutation';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: team } = useTeamQuery();
  const assistant = team?.find((assistant) => assistant.id === id);
  const conversation = useConversationQuery(id);

  if (conversation.isError) {
    return <LoadError message="Não conseguimos carregar a conversa." onRetry={() => conversation.refetch()} />;
  }
  if (!assistant || !conversation.data) return <View className="flex-1 bg-background" />;
  return <Chat assistant={assistant} conversation={conversation.data} />;
}

function Chat({ assistant, conversation }: { assistant: Assistant; conversation: Conversation }) {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const send = useSendMessageMutation(assistant.id);
  const decide = useConfirmationMutation(assistant.id);
  const [text, setText] = useState('');
  const sendAfterConsent = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const placeholder = useCSSVariable('--color-muted-foreground') as string;

  const working = send.isPending || decide.isPending || conversation.working;
  const draft = send.draft || decide.draft;
  const awaiting = conversation.items.some((item) => item.type === 'confirmation' && item.status === 'pending');
  const status = working
    ? 'Trabalhando…'
    : awaiting || assistant.playbookStatus !== 'approved'
      ? 'Esperando você'
      : assistant.title;
  const failed = (send.isError || decide.isError) && !working;

  function submit() {
    const message = text.trim();
    if (!message || working) return;
    // The AI consent sheet comes up on the first real task, then the message goes out on its own.
    if (!me?.aiConsentedAt) {
      sendAfterConsent.current = true;
      router.push('/ai-consent');
      return;
    }
    setText('');
    send.mutate(message);
  }

  // Back from the consent sheet: send if the Professional allowed, forget the send if not.
  useFocusEffect(
    useCallback(() => {
      if (!sendAfterConsent.current) return;
      sendAfterConsent.current = false;
      if (me?.aiConsentedAt) submit();
    }, [me?.aiConsentedAt, submit]),
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
        {conversation.items.map((item) =>
          item.type === 'professional' ? (
            <View key={item.id} className="flex-row justify-end">
              <Text
                selectable
                className="max-w-[82%] overflow-hidden rounded-[18px] rounded-br-md border border-border bg-card px-3.5 py-2.5 font-normal text-[15px] text-foreground leading-[22px]"
              >
                {item.text}
              </Text>
            </View>
          ) : item.type === 'assistant' ? (
            <Reply key={item.id} text={item.text} />
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
        <View
          className="flex-row items-end gap-2 rounded-[22px] border border-border bg-card py-2 pr-2 pl-4"
          style={{ borderCurve: 'continuous' }}
        >
          <TextInput
            className="max-h-32 min-h-9 flex-1 py-2 font-normal text-[15px] text-foreground"
            accessibilityLabel="Mensagem"
            placeholder={`Mensagem para ${assistant.name}`}
            placeholderTextColor={placeholder}
            multiline
            value={text}
            onChangeText={setText}
          />
          <Pressable
            className={`size-9 items-center justify-center rounded-full bg-primary ${!text.trim() || working ? 'opacity-30' : ''}`}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !text.trim() || working }}
            disabled={!text.trim() || working}
            onPress={submit}
          >
            <Icon name="send" size={17} color="--color-primary-foreground" strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Reply({ text }: { text: string }) {
  return (
    <Text selectable className="font-normal text-[15.5px] text-foreground leading-[23px]">
      {text}
    </Text>
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
