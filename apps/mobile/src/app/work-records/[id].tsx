import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, type TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { ProfessionalBubble, Reply } from '@/components/chat-messages';
import { Composer } from '@/components/composer';
import { ConfirmationCard } from '@/components/confirmation-card';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { Mascot } from '@/components/mascot';
import { OptionRow } from '@/components/option-row';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';
import { useChargeConfirmationMutation } from '@/hooks/data/work-records/use-charge-confirmation-mutation';
import { useChargeMutation } from '@/hooks/data/work-records/use-charge-mutation';
import { useChooseCustomerMutation } from '@/hooks/data/work-records/use-choose-customer-mutation';
import { useWorkRecordMessageMutation } from '@/hooks/data/work-records/use-work-record-message-mutation';
import { useWorkRecordQuery, type WorkRecord } from '@/hooks/data/work-records/use-work-record-query';
import { formatMoney, formatWholeMoney } from '@/lib/money';
import { firstName } from '@/lib/onboarding';
import { transcriptLines } from '@/lib/transcript';
import { formatTime, formatWhen } from '@/lib/when';

const paymentMethodLabels = { pix: 'Pix', cash: 'Dinheiro' } as const;
const letters = 'ABCDEFGH';

type Exchange = { id: number; text: string; status: 'sending' | 'done' | 'failed'; newCustomerName?: string | null };
// "Cobrar no Pix" before the Pix is sent; `at` is how many exchanges came before it, so later ones show below.
type ChargeFlow = { at: number; step: 'confirming' | 'cancelled' | 'no_pix_key' };
type PaidAnswer = 'received' | 'not_received';

export default function WorkRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workRecord = useWorkRecordQuery(id);

  if (workRecord.isLoadingError) {
    return <LoadError message="Não conseguimos abrir o serviço." onRetry={() => workRecord.refetch()} />;
  }
  if (!workRecord.data) return <View className="flex-1 bg-background" />;
  return <Thread workRecord={workRecord.data} />;
}

function Thread({ workRecord }: { workRecord: WorkRecord }) {
  const { top, bottom } = useSafeAreaInsets();
  const { data: team } = useTeamQuery();
  const billing = team?.find((assistant) => assistant.role === 'billing');
  const message = useWorkRecordMessageMutation(workRecord.id);
  const choose = useChooseCustomerMutation(workRecord.id);
  const [tab, setTab] = useState<'summary' | 'transcript'>('summary');
  const [text, setText] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [chargeFlow, setChargeFlow] = useState<ChargeFlow | null>(null);
  const [paidAnswer, setPaidAnswer] = useState<PaidAnswer | null>(null);
  const charge = useChargeMutation(workRecord.id);
  const confirmPaid = useChargeConfirmationMutation(workRecord.id);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  const createdAt = new Date(workRecord.createdAt);
  const working = message.isPending || choose.isPending || charge.isPending || confirmPaid.isPending;
  const customerFirstName = workRecord.customer && (firstName(workRecord.customer.name) ?? workRecord.customer.name);
  // The team actions show once the service can be charged; cash already received leaves nothing to do.
  const showActions = !!workRecord.chargeCard && !(workRecord.paid && !workRecord.charge);
  const chargeSent = !!workRecord.charge;
  const chargeBusy = !chargeSent && chargeFlow?.step === 'confirming';
  const flowAt = chargeSent ? 0 : (chargeFlow?.at ?? exchanges.length);
  const canSend = !!text.trim() && !working;
  const askingWhatsApp = !workRecord.customer && !!exchanges.at(-1)?.newCustomerName;
  const status = working ? 'Trabalhando…' : `${formatWhen(createdAt)} · ${workRecord.title ?? 'Serviço'}`;

  function submit() {
    const said = text.trim();
    if (!said || !canSend) return;
    setText('');
    setTab('summary');
    const exchange: Exchange = { id: Date.now(), text: said, status: 'sending' };
    setExchanges((list) => [...list, exchange]);
    const settle = (next: Partial<Exchange>) =>
      setExchanges((list) => list.map((item) => (item.id === exchange.id ? { ...item, ...next } : item)));
    message.mutate(said, {
      onSuccess: ({ newCustomerName }) => settle({ status: 'done', newCustomerName }),
      onError: () => settle({ status: 'failed' }),
    });
  }

  function startCharge() {
    if (chargeSent || chargeBusy || working) return;
    setTab('summary');
    setChargeFlow({ at: exchanges.length, step: workRecord.pixReady ? 'confirming' : 'no_pix_key' });
  }

  function decideCharge(confirmed: boolean) {
    if (!confirmed) {
      setChargeFlow((flow) => flow && { ...flow, step: 'cancelled' });
      return;
    }
    charge.mutate();
  }

  function answerPaid(received: boolean) {
    setPaidAnswer(received ? 'received' : 'not_received');
    confirmPaid.mutate(received);
  }

  const exchangeViews = exchanges.map((exchange) => (
    <View key={exchange.id} className="gap-3">
      <ProfessionalBubble text={exchange.text} />
      {exchange.status === 'done' && (
        <AssistantReply
          assistant={billing}
          text={
            exchange.newCustomerName
              ? `Não achei ${exchange.newCustomerName} nos seus clientes. Me passe o WhatsApp com DDD para eu cadastrar.`
              : showActions
                ? 'Anotado neste serviço. Se precisar de alguém da equipe, escolha uma ação aqui embaixo.'
                : 'Anotado neste serviço.'
          }
        />
      )}
      {exchange.status === 'failed' && (
        <Text selectable className="font-normal text-destructive text-sm">
          Não consegui anotar agora. Tente de novo.
        </Text>
      )}
    </View>
  ));

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <View className="flex-row items-center gap-2.5 px-4 pb-2.5" style={{ paddingTop: top + 16 }}>
        <BackButton />
        <View className="min-w-0 flex-row items-center gap-2 rounded-full border border-border bg-card py-[5px] pr-3.5 pl-1.5">
          <View className="size-7 items-center justify-center rounded-full bg-secondary">
            <Icon name="wrench" size={15} color="--color-muted-foreground" />
          </View>
          <View className="min-w-0">
            <Text numberOfLines={1} className="font-bold text-[14.5px] text-foreground leading-[18px]">
              {workRecord.customer?.name ?? 'Novo serviço'}
            </Text>
            <View className="flex-row items-center gap-[5px]">
              {working && <View className="size-1.5 rounded-full bg-primary" />}
              <Text numberOfLines={1} className="font-normal text-[11.5px] text-muted-foreground leading-[15px]">
                {status}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mx-4 mb-1.5 flex-row gap-[3px] rounded-xl bg-muted p-[3px]">
        <Tab label="Resumo" active={tab === 'summary'} onPress={() => setTab('summary')} />
        <Tab label="Transcrição" active={tab === 'transcript'} onPress={() => setTab('transcript')} />
      </View>

      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-[18px] pt-2 pb-4"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {tab === 'transcript' ? (
          transcriptLines(workRecord.transcript).map((line, index) => (
            <View key={`${index}-${line}`}>
              <Text className="font-semibold text-muted-foreground text-xs">Você</Text>
              <Text selectable className="mt-0.5 font-normal text-[15px] text-foreground leading-[22px]">
                {line}
              </Text>
            </View>
          ))
        ) : (
          <>
            <SummaryCard workRecord={workRecord} createdAt={createdAt} />
            <Reply
              text={
                !workRecord.customer
                  ? 'Registrei o serviço, mas não entendi de qual cliente é.'
                  : showActions
                    ? `Registrei o serviço do ${customerFirstName}. Escolha o que a equipe faz agora:`
                    : `Registrei o serviço do ${customerFirstName}.`
              }
            />
            {workRecord.paid && !workRecord.charge && workRecord.amountCents && (
              <Line text={`Pagamento recebido: ${formatMoney(workRecord.amountCents)}`} />
            )}
            {exchangeViews.slice(0, flowAt)}
            {workRecord.chargeCard && (chargeSent || chargeFlow) && (
              <ChargeThread
                workRecord={workRecord}
                card={workRecord.chargeCard}
                flow={chargeFlow}
                paidAnswer={paidAnswer}
                assistant={billing}
                sending={charge.isPending}
                sendFailed={charge.isError}
                confirmFailed={confirmPaid.isError}
                disabled={working}
                onDecide={decideCharge}
                onAnswerPaid={answerPaid}
              />
            )}
            {exchangeViews.slice(flowAt)}
            {working && <Thinking assistant={billing} label={charge.isPending ? 'Gerando o Pix' : undefined} />}
            {!working && !workRecord.customer && !askingWhatsApp && (
              <CustomerQuestion
                options={workRecord.customerOptions}
                disabled={working}
                onPick={(customerId) => choose.mutate(customerId)}
                onOther={() => input.current?.focus()}
              />
            )}
            {!working && workRecord.customer && !workRecord.amountCents && (
              <AssistantReply assistant={billing} text="Quanto ficou o serviço? Me diga aqui embaixo." />
            )}
            {choose.isError && (
              <Text selectable className="font-normal text-destructive text-sm">
                Não consegui trocar o cliente agora. Tente de novo.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {showActions && billing && (
        <ScrollView
          horizontal
          className="shrink-0 grow-0"
          contentContainerClassName="gap-2 px-4 pt-1 pb-2"
          showsHorizontalScrollIndicator={false}
        >
          <TeamAction
            label="Cobrar no Pix"
            assistant={billing}
            done={chargeSent}
            locked={chargeSent || chargeBusy || working}
            onPress={startCharge}
          />
        </ScrollView>
      )}

      <View className="px-3" style={{ paddingBottom: bottom + 10 }}>
        <Composer
          inputRef={input}
          value={text}
          onChangeText={setText}
          placeholder="Pergunte sobre este serviço"
          canSend={canSend}
          onSend={submit}
          canListen
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      className={`h-[34px] flex-1 items-center justify-center rounded-[9px] ${active ? 'bg-card' : ''}`}
      style={active ? { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
    >
      <Text className={`text-[13.5px] ${active ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryCard({ workRecord, createdAt }: { workRecord: WorkRecord; createdAt: Date }) {
  const method = paymentMethodLabels[workRecord.paymentMethod];
  const rows = [
    { label: 'Cliente', value: workRecord.customer?.name ?? '—' },
    { label: 'Serviço', value: workRecord.description ?? workRecord.title ?? '—' },
    ...(workRecord.materials ? [{ label: 'Material', value: workRecord.materials }] : []),
    {
      label: 'Valor',
      value: workRecord.amountCents ? `${formatMoney(workRecord.amountCents)} · ${method}` : `— · ${method}`,
    },
  ];
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center justify-between px-4 pt-3.5 pb-1">
        <Text className="font-extrabold text-[15.5px] text-foreground">Serviço registrado</Text>
        <Text className="h-[22px] overflow-hidden rounded-full bg-secondary px-2 font-bold text-[11.5px] text-muted-foreground leading-[22px]">
          {formatWhen(createdAt)}
        </Text>
      </View>
      <View className="px-4 pt-1 pb-3">
        {rows.map(({ label, value }) => (
          <View key={label} className="flex-row gap-2.5 py-[7px]">
            <Text className="w-24 font-normal text-muted-foreground text-sm leading-5">{label}</Text>
            <Text selectable className="flex-1 font-normal text-foreground text-sm leading-5">
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CustomerQuestion({
  options,
  disabled,
  onPick,
  onOther,
}: {
  options: WorkRecord['customerOptions'];
  disabled: boolean;
  onPick: (customerId: string) => void;
  onOther: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      <Text className="px-3.5 pb-3 font-bold text-[15px] text-foreground leading-[21px]">
        De qual cliente é este serviço?
      </Text>
      {options.map((option, index) => (
        <OptionRow
          key={option.id}
          letter={letters[index]!}
          label={option.name}
          disabled={disabled}
          onPress={() => onPick(option.id)}
        />
      ))}
      <OptionRow
        letter={letters[options.length]!}
        label="Outro"
        hint="Escreva o nome e o WhatsApp aqui embaixo"
        disabled={disabled}
        onPress={onOther}
      />
    </View>
  );
}

function AssistantReply({ assistant, text }: { assistant: Assistant | undefined; text: string }) {
  return (
    <View>
      {assistant && (
        <View className="mb-1 flex-row items-center gap-1.5">
          <Mascot mascot={assistant.mascot} size={20} />
          <Text className="font-bold text-[12.5px] text-foreground">{assistant.name}</Text>
          <Text className="font-normal text-[12.5px] text-muted-foreground">{assistant.title}</Text>
        </View>
      )}
      <Reply text={text} />
    </View>
  );
}

function Line({ text }: { text: string }) {
  return (
    <View className="flex-row items-center justify-center gap-1.5 py-0.5">
      <Icon name="check" size={14} color="--color-primary" strokeWidth={2.4} />
      <Text className="font-normal text-[12.5px] text-muted-foreground">{text}</Text>
    </View>
  );
}

function Thinking({ assistant, label = 'Pensando' }: { assistant: Assistant | undefined; label?: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      {assistant && (
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
      )}
      <Text className="font-normal text-muted-foreground text-sm">{label}</Text>
    </View>
  );
}

function TeamAction({
  label,
  assistant,
  done,
  locked,
  onPress,
}: {
  label: string;
  assistant: Assistant;
  done: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`rounded-2xl border bg-card px-3.5 py-2.5 ${done ? 'border-accent' : 'border-border'} ${locked && !done ? 'opacity-50' : ''}`}
      style={{ borderCurve: 'continuous' }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, com a ${assistant.name}`}
      accessibilityState={{ disabled: locked, checked: done }}
      disabled={locked}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-1.5">
        {done && <Icon name="check" size={14} color="--color-primary" strokeWidth={2.6} />}
        <Text className="font-bold text-foreground text-sm">{label}</Text>
      </View>
      <View className="mt-1 flex-row items-center gap-[5px]">
        <Mascot mascot={assistant.mascot} size={14} />
        <Text className="font-normal text-muted-foreground text-xs">com a {assistant.name}</Text>
      </View>
    </Pressable>
  );
}

function ChargeThread({
  workRecord,
  card,
  flow,
  paidAnswer,
  assistant,
  sending,
  sendFailed,
  confirmFailed,
  disabled,
  onDecide,
  onAnswerPaid,
}: {
  workRecord: WorkRecord;
  card: NonNullable<WorkRecord['chargeCard']>;
  flow: ChargeFlow | null;
  paidAnswer: PaidAnswer | null;
  assistant: Assistant | undefined;
  sending: boolean;
  sendFailed: boolean;
  confirmFailed: boolean;
  disabled: boolean;
  onDecide: (confirmed: boolean) => void;
  onAnswerPaid: (received: boolean) => void;
}) {
  const { charge, customer } = workRecord;
  const first = customer ? (firstName(customer.name) ?? customer.name) : '';
  if (!charge && flow?.step === 'no_pix_key') {
    return (
      <>
        <ProfessionalBubble text="Cobrar no Pix" />
        <AssistantReply
          assistant={assistant}
          text="Para cobrar no Pix, preciso da sua chave Pix. Combine comigo na nossa conversa e volte aqui."
        />
      </>
    );
  }
  const cancelled = !charge && flow?.step === 'cancelled';
  const status = charge ? 'confirmed' : cancelled ? 'cancelled' : 'pending';
  return (
    <>
      <ProfessionalBubble text="Cobrar no Pix" />
      <AssistantReply assistant={assistant} text="Montei a cobrança. Confere antes de eu mandar:" />
      <ConfirmationCard
        confirmation={{ id: 'charge', type: 'confirmation', status: sending ? 'confirmed' : status, ...card }}
        disabled={disabled}
        onDecide={onDecide}
        decisionLine={false}
      />
      {(charge || sending) && <ProfessionalBubble text="Confirmar" />}
      {cancelled && (
        <>
          <ProfessionalBubble text="Cancelar" />
          <AssistantReply assistant={assistant} text="Tudo bem, não mandei nada." />
        </>
      )}
      {sendFailed && !charge && (
        <Text selectable className="font-normal text-destructive text-sm">
          Não consegui mandar o Pix agora. Tente de novo.
        </Text>
      )}
      {charge && (
        <>
          <AssistantReply
            assistant={assistant}
            text={`Pronto, mandei o Pix para o ${first} no WhatsApp. Te aviso quando cair.`}
          />
          <PixCard workRecordId={workRecord.id} charge={charge} customerName={customer?.name ?? ''} />
          {charge.status === 'awaiting_confirmation' && (
            <View
              className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="px-3.5 pb-3 font-bold text-[15px] text-foreground leading-[21px]">
                {first} disse que já pagou. O dinheiro caiu?
              </Text>
              <OptionRow letter="A" label="Recebi" strong disabled={disabled} onPress={() => onAnswerPaid(true)} />
              <OptionRow letter="B" label="Não caiu" disabled={disabled} onPress={() => onAnswerPaid(false)} />
            </View>
          )}
          {paidAnswer && charge.status !== 'awaiting_confirmation' && (
            <ProfessionalBubble text={paidAnswer === 'received' ? 'Recebi' : 'Não caiu'} />
          )}
          {confirmFailed && (
            <Text selectable className="font-normal text-destructive text-sm">
              Não consegui anotar agora. Tente de novo.
            </Text>
          )}
          {charge.status === 'paid' && (
            <>
              <Line text={`Pagamento recebido: ${formatMoney(charge.amountCents)}`} />
              <AssistantReply
                assistant={assistant}
                text={`Caiu! Os ${formatWholeMoney(charge.amountCents)} do ${first} já estão na sua conta.`}
              />
            </>
          )}
          {paidAnswer === 'not_received' && charge.status === 'pending' && (
            <AssistantReply assistant={assistant} text="Tudo bem, a cobrança continua em aberto." />
          )}
        </>
      )}
    </>
  );
}

function PixCard({
  workRecordId,
  charge,
  customerName,
}: {
  workRecordId: string;
  charge: NonNullable<WorkRecord['charge']>;
  customerName: string;
}) {
  const paid = charge.status === 'paid' && charge.paidAt;
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card px-4 py-3.5" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center gap-3">
        <View
          className="size-10 items-center justify-center rounded-xl bg-accent"
          style={{ borderCurve: 'continuous' }}
        >
          <Icon name="pix" size={20} color="--color-accent-foreground" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-extrabold text-[18px] text-foreground">{formatMoney(charge.amountCents)}</Text>
          <Text className="font-normal text-[12.5px] text-muted-foreground">
            Pix para {customerName} · enviado no WhatsApp
          </Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <Text
          className={`h-[22px] overflow-hidden rounded-full px-2 font-bold text-[11.5px] leading-[22px] ${
            paid ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {paid ? `Pago às ${formatTime(new Date(charge.paidAt!))}` : 'Aguardando pagamento'}
        </Text>
        {!!charge.pixCode && (
          <Pressable
            className="h-[38px] items-center justify-center rounded-full border border-input px-3.5 active:bg-secondary"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/work-records/pix-qr-code', params: { id: workRecordId } })}
          >
            <Text className="font-bold text-[13.5px] text-foreground">Mostrar QR Code</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
