import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, type TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Reply } from '@/components/chat-messages';
import { Composer } from '@/components/composer';
import { CustomerQuestion } from '@/components/customer-question';
import { useChooseCustomerMutation } from '@/hooks/data/work-records/use-choose-customer-mutation';
import {
  useCreateWorkRecordMutation,
  type WorkRecord,
} from '@/hooks/data/work-records/use-create-work-record-mutation';
import { useTranscriptionMutation } from '@/hooks/data/work-records/use-transcription-mutation';
import { useWorkRecordMessageMutation } from '@/hooks/data/work-records/use-work-record-message-mutation';
import { transcriptLines } from '@/lib/transcript';
import { formatWhen } from '@/lib/when';

// The prototype swaps Cancelar for Finalizar once the Professional has started talking.
const talkingAfterMillis = 2000;

export default function RecordWorkRecord() {
  const { top, bottom } = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder, 250);
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const transcription = useTranscriptionMutation();
  const create = useCreateWorkRecordMutation(visitId);
  const [startedAt] = useState(() => new Date());
  const [uri, setUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const lines = transcription.data ? transcriptLines(transcription.data.transcript) : [];
  const listening = !uri && !denied;
  // Without a Customer the screen asks who it is for; with one, it is already opening the Customer's thread.
  const unknownCustomer = create.data && !create.data.customer ? create.data : null;
  const summarizing = transcription.isPending || create.isPending || (create.isSuccess && !unknownCustomer);
  const talking = recording.durationMillis >= talkingAfterMillis;
  const nothingHeard = (transcription.error as { status?: number } | null)?.status === 422;

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    setDenied(!granted);
    if (!granted) return;
    setUri(null);
    transcription.reset();
    create.reset();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function cancel() {
    if (recorder.isRecording) await recorder.stop();
    router.back();
  }

  async function finish() {
    await recorder.stop();
    if (!recorder.uri) return;
    setUri(recorder.uri);
    send(recorder.uri);
  }

  function send(recorded: string) {
    transcription.mutate(recorded, { onSuccess: ({ transcript }) => summarize(transcript) });
  }

  function summarize(transcript: string) {
    create.mutate(transcript, {
      onSuccess: ({ customer }) => customer && openThread(customer.id),
    });
  }

  useEffect(() => {
    start();
  }, []);

  if (unknownCustomer) {
    return (
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-card" style={{ paddingTop: top + 16 }}>
        <View className="flex-row px-5">
          <BackButton />
        </View>
        <CustomerStep workRecord={unknownCustomer} lines={lines} bottom={bottom} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 16, paddingBottom: bottom + 26 }}>
      <View className="flex-row">
        <BackButton onPress={cancel} />
      </View>
      <Text className="mt-[22px] font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
        Novo serviço
      </Text>
      <View className="mt-3 flex-row gap-2">
        <Pill text={formatWhen(startedAt)} />
        {listening && recording.isRecording && <ListeningPill />}
        {summarizing && <Pill text="Resumindo…" />}
      </View>

      <ScrollView className="mt-[22px] flex-1" contentContainerClassName="gap-4" showsVerticalScrollIndicator={false}>
        {!uri && (
          <Text className="font-normal text-[15px] text-muted-foreground leading-[22px]">
            {denied
              ? 'Para gravar, permita o microfone nas configurações do celular.'
              : 'Conte o que você fez: o serviço, o material que usou e o valor. A transcrição aparece aqui quando você terminar.'}
          </Text>
        )}
        {lines.map((line, index) => (
          <View key={`${index}-${line}`}>
            <Text className="font-semibold text-muted-foreground text-xs">Você</Text>
            <Text selectable className="mt-0.5 font-normal text-base text-foreground leading-6">
              {line}
            </Text>
          </View>
        ))}
        {transcription.isError && (
          <Text selectable className="font-normal text-[15px] text-destructive leading-[22px]">
            {nothingHeard
              ? 'Não ouvi nada nesse áudio. Grave de novo, mais perto do celular.'
              : 'Não consegui entender o áudio agora. Tente de novo.'}
          </Text>
        )}
        {create.isError && (
          <Text selectable className="font-normal text-[15px] text-destructive leading-[22px]">
            Não consegui resumir o serviço agora. Tente de novo.
          </Text>
        )}
      </ScrollView>

      {listening && talking && (
        <Text className="mb-2.5 self-center font-normal text-[13px] text-muted-foreground">
          Toque em Finalizar quando terminar de contar.
        </Text>
      )}
      {summarizing ? (
        <View className="h-[58px] items-center justify-center rounded-full bg-secondary">
          <Text className="font-semibold text-foreground text-sm">Separando serviço, material e valor…</Text>
        </View>
      ) : transcription.isError ? (
        <BarButton
          label={nothingHeard ? 'Gravar de novo' : 'Tentar de novo'}
          onPress={() => (nothingHeard || !uri ? start() : send(uri))}
        />
      ) : create.isError && transcription.data ? (
        <BarButton label="Tentar de novo" onPress={() => summarize(transcription.data.transcript)} />
      ) : denied ? (
        <BarButton label="Tentar de novo" onPress={start} />
      ) : (
        <RecordingBar
          millis={recording.durationMillis}
          talking={talking}
          onCancel={cancel}
          onFinish={finish}
          disabled={!recording.isRecording}
        />
      )}
    </View>
  );
}

function openThread(customerId: string) {
  router.replace({ pathname: '/customers/[id]', params: { id: customerId } });
}

// The record was saved without a Customer: picking one, or writing a new one's name and WhatsApp, opens their thread.
function CustomerStep({ workRecord, lines, bottom }: { workRecord: WorkRecord; lines: string[]; bottom: number }) {
  const choose = useChooseCustomerMutation(workRecord.id);
  const message = useWorkRecordMessageMutation(workRecord.id);
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const working = choose.isPending || message.isPending;
  const newCustomerName = message.data?.newCustomerName;

  function send() {
    const said = text.trim();
    if (!said || working) return;
    setText('');
    message.mutate(said, { onSuccess: ({ customer }) => customer && openThread(customer.id) });
  }

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pt-[22px] pb-4"
        keyboardDismissMode="interactive"
      >
        <Text className="font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
          Novo serviço
        </Text>
        {lines.map((line, index) => (
          <View key={`${index}-${line}`}>
            <Text className="font-semibold text-muted-foreground text-xs">Você</Text>
            <Text selectable className="mt-0.5 font-normal text-base text-foreground leading-6">
              {line}
            </Text>
          </View>
        ))}
        {newCustomerName ? (
          <Reply
            text={`Não achei ${newCustomerName} nos seus clientes. Me passe o WhatsApp com DDD para eu cadastrar.`}
          />
        ) : (
          <CustomerQuestion
            options={workRecord.customerOptions}
            disabled={working}
            onPick={(customerId) => choose.mutate(customerId, { onSuccess: () => openThread(customerId) })}
            onOther={() => input.current?.focus()}
          />
        )}
        {(choose.isError || message.isError) && (
          <Text selectable className="font-normal text-destructive text-sm">
            Não consegui anotar agora. Tente de novo.
          </Text>
        )}
      </ScrollView>
      <View className="px-3" style={{ paddingBottom: bottom + 10 }}>
        <Composer
          inputRef={input}
          value={text}
          onChangeText={setText}
          placeholder={newCustomerName ? 'WhatsApp com DDD' : 'Nome e WhatsApp do cliente'}
          canSend={!!text.trim() && !working}
          onSend={send}
          canListen
        />
      </View>
    </>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <Text className="h-7 overflow-hidden rounded-full bg-secondary px-2.5 font-bold text-[11.5px] text-muted-foreground leading-7">
      {text}
    </Text>
  );
}

function ListeningPill() {
  return (
    <View className="h-7 flex-row items-center gap-1 rounded-full bg-primary/10 px-2.5">
      <Animated.View
        className="size-1.5 rounded-full bg-primary"
        style={{
          animationName: {
            from: { opacity: 0.5, transform: [{ scale: 0.92 }] },
            to: { opacity: 1, transform: [{ scale: 1 }] },
          },
          animationDuration: '500ms',
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
          animationTimingFunction: 'ease-in-out',
        }}
      />
      <Text className="font-bold text-[11.5px] text-foreground">Ouvindo</Text>
    </View>
  );
}

function RecordingBar({
  millis,
  talking,
  disabled,
  onCancel,
  onFinish,
}: {
  millis: number;
  talking: boolean;
  disabled: boolean;
  onCancel: () => void;
  onFinish: () => void;
}) {
  return (
    <View className="h-[62px] flex-row items-center gap-3 rounded-full bg-primary px-2">
      <View className="size-[46px] flex-row items-center justify-center gap-1 rounded-full bg-primary-foreground/20">
        <View className="h-3.5 w-1 rounded-sm bg-primary-foreground" />
        <View className="h-3.5 w-1 rounded-sm bg-primary-foreground" />
      </View>
      <View className="h-5 flex-row items-center gap-[3px]" accessible={false}>
        {[0, 150, 300, 450].map((delay) => (
          <Animated.View
            key={delay}
            className="w-[3px] rounded-[3px] bg-primary-foreground"
            style={{
              height: 6,
              animationName: { '0%': { height: 6 }, '50%': { height: 18 }, '100%': { height: 6 } },
              animationDuration: '1s',
              animationDelay: `${delay}ms`,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          />
        ))}
      </View>
      <Text className="font-bold text-base text-primary-foreground" style={{ fontVariant: ['tabular-nums'] }}>
        {formatDuration(millis)}
      </Text>
      <View className="flex-1" />
      {talking ? (
        <Pressable
          className="h-[46px] justify-center rounded-full bg-card px-5 active:opacity-80"
          accessibilityRole="button"
          disabled={disabled}
          onPress={onFinish}
        >
          <Text className="font-bold text-base text-foreground">Finalizar</Text>
        </Pressable>
      ) : (
        <Pressable
          className="h-[46px] justify-center rounded-full bg-primary-foreground/15 px-[18px] active:opacity-80"
          accessibilityRole="button"
          onPress={onCancel}
        >
          <Text className="font-bold text-base text-primary-foreground">Cancelar</Text>
        </Pressable>
      )}
    </View>
  );
}

function BarButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      className="h-[58px] items-center justify-center rounded-full bg-primary active:opacity-90"
      accessibilityRole="button"
      onPress={onPress}
    >
      <Text className="font-bold text-base text-primary-foreground">{label}</Text>
    </Pressable>
  );
}

function formatDuration(millis: number) {
  const seconds = Math.floor(millis / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
