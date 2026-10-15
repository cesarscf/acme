import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { type Ref, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useTranscriptionMutation } from '@/hooks/data/work-records/use-transcription-mutation';
import { selectionFeedback } from '@/lib/haptics';
import { Icon } from './icons';

// The prototype's "Ver agora" menu: what each tag asks the Assistant for.
const mentions = [
  { tag: '@agenda', detail: 'de amanhã' },
  { tag: '@cobranças', detail: 'em aberto' },
  { tag: '@caixa', detail: 'do mês' },
];

export function Composer({
  inputRef,
  value,
  onChangeText,
  placeholder,
  editable = true,
  canSend,
  onSend,
  onMention,
  canListen,
  onListenBlocked,
  drawer,
}: {
  inputRef?: Ref<TextInput>;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  editable?: boolean;
  canSend: boolean;
  onSend: () => void;
  onMention?: (message: string) => void;
  // Voice goes through the AI transcription, so it waits for the AI consent like a message does.
  canListen: boolean;
  onListenBlocked?: () => void;
  drawer?: React.ReactNode;
}) {
  const placeholderColor = useCSSVariable('--color-muted-foreground') as string;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder, 250);
  const transcription = useTranscriptionMutation();
  const holding = useRef(false);
  const [menu, setMenu] = useState(false);

  const listening = recording.isRecording;
  const nothingHeard = (transcription.error as { status?: number } | null)?.status === 422;

  function changeText(text: string) {
    onChangeText(text);
    if (onMention) setMenu(/(^|\s)@$/.test(text));
  }

  function mention(message: string) {
    setMenu(false);
    onChangeText('');
    onMention?.(message);
  }

  // Hold to talk: what was said lands in the box, to read before sending.
  async function startListening() {
    if (!canListen) return onListenBlocked?.();
    holding.current = true;
    transcription.reset();
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Microfone bloqueado', 'Para falar, permita o microfone nas configurações do celular.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    if (!holding.current) return;
    selectionFeedback();
    recorder.record();
  }

  async function stopListening() {
    holding.current = false;
    if (!recorder.isRecording) return;
    await recorder.stop();
    if (!recorder.uri) return;
    transcription.mutate(recorder.uri, {
      onSuccess: ({ transcript }) => onChangeText(value.trim() ? `${value.trim()} ${transcript}` : transcript),
    });
  }

  return (
    <View>
      {menu && (
        <View
          className="mb-2 rounded-[20px] border border-secondary bg-card py-2"
          style={{ boxShadow: '0 12px 32px rgba(14,19,25,0.14)', borderCurve: 'continuous' }}
        >
          <Text className="px-4 pt-1.5 pb-1 font-normal text-muted-foreground text-xs">Ver agora</Text>
          {mentions.map(({ tag, detail }) => (
            <Pressable
              key={tag}
              className="min-h-11 flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary"
              accessibilityRole="button"
              onPress={() => mention(`${tag} ${detail}`)}
            >
              <View className="size-7 items-center justify-center rounded-lg bg-secondary">
                <Text className="font-extrabold text-[13px] text-muted-foreground">@</Text>
              </View>
              <Text className="font-bold text-[14.5px] text-foreground">
                {tag} <Text className="font-normal text-muted-foreground">· {detail}</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {drawer}
      <View
        className="rounded-[22px] border border-border bg-card px-3 pt-3 pb-2.5"
        style={{ boxShadow: '0 4px 16px rgba(14,19,25,0.06)', borderCurve: 'continuous' }}
      >
        <TextInput
          ref={inputRef}
          className="max-h-32 px-1 pt-0.5 pb-2.5 font-normal text-[15px] text-foreground"
          accessibilityLabel="Mensagem"
          editable={editable && !listening && !transcription.isPending}
          placeholder={
            listening ? 'Ouvindo… solte para parar' : transcription.isPending ? 'Transcrevendo…' : placeholder
          }
          placeholderTextColor={placeholderColor}
          multiline
          value={value}
          onChangeText={changeText}
        />
        {transcription.isError && (
          <Text className="px-1 pb-2 font-normal text-[12.5px] text-destructive">
            {nothingHeard ? 'Não ouvi nada. Segure e fale mais perto do celular.' : 'Não consegui entender o áudio.'}
          </Text>
        )}
        <View className="flex-row items-center gap-2">
          <RoundButton
            label="Anexar foto"
            icon="attach"
            onPress={() => Alert.alert('Em breve', 'Anexar fotos da câmera ou da galeria chega numa próxima versão.')}
          />
          {onMention && <RoundButton label="Ver dados com @" icon="at" active={menu} onPress={() => setMenu(!menu)} />}
          <View className="flex-1" />
          <Pressable
            className={`size-9 items-center justify-center rounded-full border ${
              listening ? 'border-primary bg-primary' : 'border-border active:bg-secondary'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Falar por áudio"
            accessibilityHint="Segure para falar"
            disabled={!editable || transcription.isPending}
            onPressIn={startListening}
            onPressOut={stopListening}
          >
            <Icon name="mic" size={17} color={listening ? '--color-primary-foreground' : '--color-muted-foreground'} />
          </Pressable>
          <Pressable
            className={`size-9 items-center justify-center rounded-full bg-primary ${canSend ? '' : 'opacity-30'}`}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => {
              setMenu(false);
              onSend();
            }}
          >
            <Icon name="send" size={17} color="--color-primary-foreground" strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RoundButton({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string;
  icon: 'attach' | 'at';
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`size-9 items-center justify-center rounded-full border border-border active:bg-secondary ${
        active ? 'bg-secondary' : ''
      }`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Icon name={icon} size={17} color="--color-muted-foreground" />
    </Pressable>
  );
}
