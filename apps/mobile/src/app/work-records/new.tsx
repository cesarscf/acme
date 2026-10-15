import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { type Customer, useCustomersQuery } from '@/hooks/data/customers/use-customers-query';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { useCreateWorkRecordMutation } from '@/hooks/data/work-records/use-create-work-record-mutation';
import {
  useDraftWorkRecordMutation,
  type WorkRecordDraft,
} from '@/hooks/data/work-records/use-draft-work-record-mutation';
import {
  type PaymentMethod,
  useWorkRecordFormQuery,
  type WorkRecordForm,
} from '@/hooks/data/work-records/use-work-record-form-query';
import { formatMoneyInput, parseMoney } from '@/lib/money';

const paymentMethodLabels: Record<PaymentMethod, string> = { pix: 'Pix', cash: 'Dinheiro' };

export default function NewWorkRecord() {
  const form = useWorkRecordFormQuery();
  const customers = useCustomersQuery();

  if (form.isError || customers.isError) {
    return (
      <LoadError
        message="Não conseguimos abrir o registro do serviço."
        onRetry={() => (form.isError ? form.refetch() : customers.refetch())}
      />
    );
  }
  if (!form.data || !customers.data) return <View className="flex-1 bg-card" />;
  return <WorkRecordScreen form={form.data} customers={customers.data} />;
}

function WorkRecordScreen({ form, customers }: { form: WorkRecordForm; customers: Customer[] }) {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const create = useCreateWorkRecordMutation();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(form.paymentMethods.default);
  const [received, setReceived] = useState<boolean | null>(null);

  const customer = customers.find(({ id }) => id === customerId);
  const visits = form.visits.filter((visit) => visit.customerId === customerId);
  const amountCents = parseMoney(amount);
  const canSave =
    !!customer && !!description.trim() && !!amountCents && (paymentMethod !== 'cash' || received !== null);

  function fill({ draft }: WorkRecordDraft) {
    if (draft.customerId) setCustomerId(draft.customerId);
    setVisitId(draft.visitId);
    if (draft.description) setDescription(draft.description);
    if (draft.materials) setMaterials(draft.materials);
    if (draft.amountCents) setAmount(formatMoneyInput(draft.amountCents));
    setPaymentMethod(draft.paymentMethod);
  }

  function chooseCustomer(id: string | null) {
    setCustomerId(id);
    setVisitId(form.visits.find((visit) => visit.customerId === id)?.id ?? null);
  }

  function save() {
    if (!canSave || !amountCents || create.isPending) return;
    create.mutate(
      {
        customerId: customer.id,
        visitId,
        description,
        materials: materials.trim() || null,
        amountCents,
        paymentMethod,
        ...(paymentMethod === 'cash' && { received: !!received }),
      },
      {
        onSuccess: ({ charge }) => {
          router.back();
          Alert.alert('Serviço registrado', charge ? 'Anotei que o pagamento em dinheiro já foi recebido.' : undefined);
        },
      },
    );
  }

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-5 pb-2" style={{ paddingTop: top + 18 }}>
        <BackButton />
        <Text className="font-extrabold text-[22px] text-foreground tracking-[-0.22px]">Novo serviço</Text>
      </View>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottom + 24 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AudioCard aiConsented={!!me?.aiConsentedAt} onDraft={fill} />

        <Label text="Cliente" />
        <CustomerPicker customers={customers} customer={customer} onChoose={chooseCustomer} />

        {visits.length > 0 && (
          <>
            <Label text="Visita" />
            <View className="flex-row flex-wrap gap-2">
              {visits.map((visit) => (
                <Chip
                  key={visit.id}
                  label={visit.when}
                  selected={visit.id === visitId}
                  onPress={() => setVisitId(visit.id === visitId ? null : visit.id)}
                />
              ))}
            </View>
          </>
        )}

        <Label text="O que foi feito" />
        <Field
          accessibilityLabel="O que foi feito"
          placeholder="Ex.: troca do capacitor"
          multiline
          className="h-auto min-h-14 py-3.5"
          value={description}
          onChangeText={setDescription}
        />

        <Label text="Material" />
        <Field
          accessibilityLabel="Material usado"
          placeholder="Ex.: 2 metros de cobre (opcional)"
          value={materials}
          onChangeText={setMaterials}
        />

        <Label text="Valor" />
        <Field
          accessibilityLabel="Valor em reais"
          placeholder="R$ 0,00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        {!!amount && !amountCents && (
          <Text className="mt-1.5 font-normal text-destructive text-sm">Escreva o valor como 350 ou 350,50.</Text>
        )}

        <Label text="Como o cliente vai pagar?" />
        <View className="flex-row flex-wrap gap-2">
          {form.paymentMethods.accepted.map((method) => (
            <Chip
              key={method}
              label={paymentMethodLabels[method]}
              selected={method === paymentMethod}
              onPress={() => setPaymentMethod(method)}
            />
          ))}
        </View>

        {paymentMethod === 'cash' && (
          <>
            <Label text="Já recebeu?" />
            <View className="flex-row flex-wrap gap-2">
              <Chip label="Já recebi" selected={received === true} onPress={() => setReceived(true)} />
              <Chip label="Ainda não" selected={received === false} onPress={() => setReceived(false)} />
            </View>
          </>
        )}

        {create.isError && (
          <Text selectable className="mt-4 font-normal text-destructive text-sm">
            Não conseguimos salvar. Tente de novo.
          </Text>
        )}
        <Button className="mt-6" label="Salvar" disabled={!canSave} loading={create.isPending} onPress={save} />
      </KeyboardAwareScrollView>
    </View>
  );
}

function AudioCard({ aiConsented, onDraft }: { aiConsented: boolean; onDraft: (draft: WorkRecordDraft) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder);
  const draft = useDraftWorkRecordMutation();
  const [uri, setUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const recordAfterConsent = useRef(false);
  const spinner = useCSSVariable('--color-muted-foreground') as string;

  async function start() {
    // The AI consent sheet comes up on the first real task, then the recording starts on its own.
    if (!aiConsented) {
      recordAfterConsent.current = true;
      router.push('/ai-consent');
      return;
    }
    const { granted } = await requestRecordingPermissionsAsync();
    setDenied(!granted);
    if (!granted) return;
    draft.reset();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function finish() {
    await recorder.stop();
    if (!recorder.uri) return;
    setUri(recorder.uri);
    send(recorder.uri);
  }

  function send(recorded: string) {
    draft.mutate(recorded, { onSuccess: onDraft });
  }

  useFocusEffect(
    useCallback(() => {
      if (!recordAfterConsent.current) return;
      recordAfterConsent.current = false;
      if (aiConsented) start();
    }, [aiConsented, start]),
  );

  if (recording.isRecording) {
    return (
      <View
        className="flex-row items-center gap-3 rounded-[22px] bg-primary px-4 py-3"
        style={{ borderCurve: 'continuous' }}
      >
        <View className="size-2 rounded-full bg-primary-foreground" />
        <Text className="font-bold text-base text-primary-foreground" style={{ fontVariant: ['tabular-nums'] }}>
          Ouvindo · {formatDuration(recording.durationMillis)}
        </Text>
        <View className="flex-1" />
        <Pressable
          className="h-10 justify-center rounded-full px-3 active:opacity-70"
          accessibilityRole="button"
          onPress={() => recorder.stop()}
        >
          <Text className="font-bold text-primary-foreground text-sm">Cancelar</Text>
        </Pressable>
        <Pressable
          className="h-10 justify-center rounded-full bg-card px-4 active:opacity-80"
          accessibilityRole="button"
          onPress={finish}
        >
          <Text className="font-bold text-foreground text-sm">Finalizar</Text>
        </Pressable>
      </View>
    );
  }

  if (draft.isPending) {
    return (
      <View className="h-[58px] flex-row items-center justify-center gap-2.5 rounded-[22px] bg-secondary">
        <ActivityIndicator color={spinner} />
        <Text className="font-semibold text-muted-foreground text-sm">Separando serviço, material e valor…</Text>
      </View>
    );
  }

  const status = (draft.error as { status?: number } | null)?.status;
  return (
    <View className="gap-3 rounded-[22px] bg-secondary p-4" style={{ borderCurve: 'continuous' }}>
      {draft.isError ? (
        <Text selectable className="font-normal text-[14.5px] text-destructive leading-[21px]">
          {status === 422
            ? 'Não ouvi nada nesse áudio. Grave de novo, mais perto do celular.'
            : 'Não conseguimos entender o áudio agora. Tente de novo ou preencha abaixo.'}
        </Text>
      ) : draft.data ? (
        <Text selectable className="font-normal text-[14.5px] text-foreground leading-[21px]">
          “{draft.data.transcript}”
        </Text>
      ) : (
        <Text className="font-normal text-[14.5px] text-muted-foreground leading-[21px]">
          Conte o que você fez: o serviço, o material e o valor. Eu preencho para você conferir. Se preferir, preencha
          direto abaixo.
        </Text>
      )}
      {denied && (
        <Text className="font-normal text-destructive text-sm">
          Para gravar, permita o microfone nas configurações do celular.
        </Text>
      )}
      <View className="flex-row gap-2">
        {draft.isError && status !== 422 && uri && (
          <Pressable
            className="h-10 justify-center rounded-full bg-primary px-4 active:opacity-80"
            accessibilityRole="button"
            onPress={() => send(uri)}
          >
            <Text className="font-bold text-primary-foreground text-sm">Tentar de novo</Text>
          </Pressable>
        )}
        <Pressable
          className="h-10 flex-row items-center gap-2 rounded-full border border-border bg-card px-4 active:bg-secondary"
          accessibilityRole="button"
          onPress={start}
        >
          <Icon name="mic" size={16} />
          <Text className="font-bold text-foreground text-sm">
            {draft.data || draft.isError ? 'Gravar de novo' : 'Gravar áudio'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CustomerPicker({
  customers,
  customer,
  onChoose,
}: {
  customers: Customer[];
  customer: Customer | undefined;
  onChoose: (id: string | null) => void;
}) {
  const [query, setQuery] = useState('');

  if (customer) {
    return (
      <View className="min-h-14 flex-row items-center rounded-2xl border-[1.5px] border-input px-4">
        <Text className="flex-1 font-semibold text-base text-foreground">{customer.name}</Text>
        <Pressable className="h-10 justify-center px-2" accessibilityRole="button" onPress={() => onChoose(null)}>
          <Text className="font-bold text-primary text-sm">Trocar</Text>
        </Pressable>
      </View>
    );
  }

  const typed = query.trim().toLocaleLowerCase('pt-BR');
  const matches = customers.filter(({ name }) => name.toLocaleLowerCase('pt-BR').includes(typed)).slice(0, 6);
  return (
    <View>
      <Field accessibilityLabel="Buscar cliente" placeholder="Buscar cliente" value={query} onChangeText={setQuery} />
      {matches.map((match) => (
        <Pressable
          key={match.id}
          className="min-h-12 justify-center border-border border-b px-1 active:bg-secondary"
          accessibilityRole="button"
          onPress={() => onChoose(match.id)}
        >
          <Text className="font-medium text-[15px] text-foreground">{match.name}</Text>
        </Pressable>
      ))}
      <Pressable
        className="h-11 justify-center px-1"
        accessibilityRole="button"
        onPress={() => router.push('/customers/new')}
      >
        <Text className="font-bold text-primary text-sm">Novo cliente</Text>
      </Pressable>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text className="mt-5 mb-2 font-bold text-[13px] text-muted-foreground">{text}</Text>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      className={`h-10 justify-center rounded-full px-4 ${selected ? 'bg-primary' : 'border border-border active:bg-secondary'}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <Text className={`font-semibold text-sm ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDuration(millis: number) {
  const seconds = Math.floor(millis / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
