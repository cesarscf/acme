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
import { ProfessionalBubble, Reply } from '@/components/chat-messages';
import { Composer } from '@/components/composer';
import { CustomerQuestion } from '@/components/customer-question';
import { OptionRow } from '@/components/option-row';
import { useCreateWorkRecordMutation } from '@/hooks/data/work-records/use-create-work-record-mutation';
import { useMatchVisitMutation, type VisitMatch } from '@/hooks/data/work-records/use-match-visit-mutation';
import { useTranscriptionMutation } from '@/hooks/data/work-records/use-transcription-mutation';
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
  const match = useMatchVisitMutation();
  const create = useCreateWorkRecordMutation();
  const [startedAt] = useState(() => new Date());
  const [uri, setUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  // Nothing is saved until the Professional picks a Visit, or a Customer after "Outro cliente".
  const [askingCustomer, setAskingCustomer] = useState(false);

  const transcript = transcription.data?.transcript;
  const lines = transcript ? transcriptLines(transcript) : [];
  const listening = !uri && !denied;
  const choosingVisit = match.data && !askingCustomer && !create.isPending && !create.isSuccess ? match.data : null;
  const searching = transcription.isPending || match.isPending;
  const summarizing = create.isPending || create.isSuccess;
  const talking = recording.durationMillis >= talkingAfterMillis;
  const nothingHeard = (transcription.error as { status?: number } | null)?.status === 422;

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    setDenied(!granted);
    if (!granted) return;
    setUri(null);
    setAskingCustomer(false);
    transcription.reset();
    match.reset();
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
    transcription.mutate(recorded, { onSuccess: ({ transcript: said }) => findVisit(said) });
  }

  function findVisit(said: string) {
    // With no Visit to tell, the question is straight away which Customer it is.
    match.mutate(
      { transcript: said, visitId },
      { onSuccess: ({ suggested, others }) => setAskingCustomer(!suggested && !others.length) },
    );
  }

  function saveOnVisit(said: string, chosenVisitId: string) {
    create.mutate(
      { transcript: said, visitId: chosenVisitId },
      { onSuccess: ({ customer }) => openThread(customer!.id) },
    );
  }

  useEffect(() => {
    start();
  }, []);

  if (askingCustomer && transcript && match.data) {
    return (
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-card" style={{ paddingTop: top + 16 }}>
        <View className="flex-row px-5">
          <BackButton />
        </View>
        <CustomerStep
          transcript={transcript}
          lines={lines}
          options={match.data.customers}
          create={create}
          bottom={bottom}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 16, paddingBottom: bottom + 26 }}>
      <View className="flex-row">
        <BackButton onPress={cancel} />
      </View>
      <Text className="mt-[22px] font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
        Conte como foi
      </Text>
      <View className="mt-3 flex-row gap-2">
        <Pill text={formatWhen(startedAt)} />
        {listening && recording.isRecording && <ListeningPill />}
      </View>

      <ScrollView className="mt-[22px] flex-1" contentContainerClassName="gap-4" showsVerticalScrollIndicator={false}>
        {!uri && (
          <Text className="font-normal text-[15px] text-muted-foreground leading-[22px]">
            {denied
              ? 'Para gravar, permita o microfone nas configurações do celular.'
              : 'Conte como foi: de qual cliente é, o que você fez, o material, o valor e se precisa de orçamento. A transcrição aparece aqui quando você terminar.'}
          </Text>
        )}
        <TranscriptLines lines={lines} />
        {choosingVisit && transcript && (
          <VisitQuestion
            match={choosingVisit}
            onPick={(chosen) => saveOnVisit(transcript, chosen)}
            onOtherCustomer={() => setAskingCustomer(true)}
          />
        )}
        {transcription.isError && (
          <Text selectable className="font-normal text-[15px] text-destructive leading-[22px]">
            {nothingHeard
              ? 'Não ouvi nada nesse áudio. Grave de novo, mais perto do celular.'
              : 'Não consegui entender o áudio agora. Tente de novo.'}
          </Text>
        )}
        {(match.isError || create.isError) && (
          <Text selectable className="font-normal text-[15px] text-destructive leading-[22px]">
            Não consegui organizar o que você contou agora. Tente de novo.
          </Text>
        )}
      </ScrollView>

      {listening && talking && (
        <Text className="mb-2.5 self-center font-normal text-[13px] text-muted-foreground">
          Toque em Finalizar quando terminar de contar.
        </Text>
      )}
      {searching || summarizing ? (
        <View className="h-[58px] items-center justify-center rounded-full bg-secondary">
          <Text className="font-semibold text-foreground text-sm">
            {searching ? 'Procurando a visita na agenda…' : 'Separando serviço, material e valor…'}
          </Text>
        </View>
      ) : transcription.isError ? (
        <BarButton
          label={nothingHeard ? 'Gravar de novo' : 'Tentar de novo'}
          onPress={() => (nothingHeard || !uri ? start() : send(uri))}
        />
      ) : match.isError && transcript ? (
        <BarButton label="Tentar de novo" onPress={() => findVisit(transcript)} />
      ) : create.isError && transcript && create.variables?.visitId ? (
        <BarButton label="Tentar de novo" onPress={() => saveOnVisit(transcript, create.variables!.visitId!)} />
      ) : denied ? (
        <BarButton label="Tentar de novo" onPress={start} />
      ) : choosingVisit ? null : (
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

function TranscriptLines({ lines }: { lines: string[] }) {
  return lines.map((line, index) => (
    <View key={`${index}-${line}`}>
      <Text className="font-semibold text-muted-foreground text-xs">Você</Text>
      <Text selectable className="mt-0.5 font-normal text-base text-foreground leading-6">
        {line}
      </Text>
    </View>
  ));
}

// "Pelo que você contou, é do João Pereira?": the suggested Visit, the others that can be told, or another Customer.
function VisitQuestion({
  match,
  onPick,
  onOtherCustomer,
}: {
  match: VisitMatch;
  onPick: (visitId: string) => void;
  onOtherCustomer: () => void;
}) {
  const { suggested, others } = match;
  const letters = 'ABCDEFGH';
  const offset = suggested ? 1 : 0;
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="px-3.5 pb-3">
        <Text className="font-bold text-[15px] text-foreground leading-[21px]">
          {suggested ? suggested.question : 'De qual visita é o que você contou?'}
        </Text>
        {suggested && <Text className="mt-0.5 font-normal text-[13px] text-muted-foreground">{suggested.detail}</Text>}
      </View>
      {suggested && (
        <OptionRow letter="A" label="Sim, é essa" strong disabled={false} onPress={() => onPick(suggested.visitId)} />
      )}
      {others.map((other, index) => (
        <OptionRow
          key={other.visitId}
          letter={letters[index + offset]!}
          label={other.customerName}
          hint={other.detail}
          disabled={false}
          onPress={() => onPick(other.visitId)}
        />
      ))}
      <OptionRow
        letter={letters[others.length + offset]!}
        label="Outro cliente"
        hint="Sem visita marcada, ou cliente novo"
        disabled={false}
        onPress={onOtherCustomer}
      />
    </View>
  );
}

function openThread(customerId: string) {
  // From the Customer's thread the recording goes back to it; from home it opens it.
  router.dismissTo({ pathname: '/customers/[id]', params: { id: customerId } });
}

// "De qual cliente é este serviço?": one of the likely Customers, or a new one's name and WhatsApp written below.
// Nothing is saved until the Customer is known, so leaving here leaves nothing behind.
function CustomerStep({
  transcript,
  lines,
  options,
  create,
  bottom,
}: {
  transcript: string;
  lines: string[];
  options: VisitMatch['customers'];
  create: ReturnType<typeof useCreateWorkRecordMutation>;
  bottom: number;
}) {
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  // What was written so far about the new Customer: the name first, then the WhatsApp the API asks for.
  const [written, setWritten] = useState('');
  const unknown = create.error as { status?: number; value?: { newCustomerName?: string | null } } | null;
  const newCustomerName = unknown?.status === 409 ? unknown.value?.newCustomerName : null;
  const working = create.isPending || create.isSuccess;

  function send() {
    const said = text.trim();
    if (!said || working) return;
    const customer = [written, said].filter(Boolean).join(' ');
    setText('');
    setWritten(customer);
    create.mutate({ transcript, customer }, { onSuccess: ({ customer: saved }) => openThread(saved!.id) });
  }

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pt-[22px] pb-4"
        keyboardDismissMode="interactive"
      >
        <Text className="font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
          Conte como foi
        </Text>
        <TranscriptLines lines={lines} />
        {written && <ProfessionalBubble text={written} />}
        {newCustomerName ? (
          <Reply
            text={`Não achei ${newCustomerName} nos seus clientes. Me passe o WhatsApp com DDD para eu cadastrar.`}
          />
        ) : written && unknown?.status === 409 ? (
          <Reply text="Não entendi de qual cliente é. Escreva o nome e o WhatsApp com DDD." />
        ) : (
          <CustomerQuestion
            options={options}
            disabled={working}
            onPick={(customerId) =>
              create.mutate({ transcript, customerId }, { onSuccess: () => openThread(customerId) })
            }
            onOther={() => input.current?.focus()}
          />
        )}
        {create.isError && unknown?.status !== 409 && (
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
