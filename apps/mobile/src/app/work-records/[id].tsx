import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { BackButton } from '@/components/back-button';
import { ProfessionalBubble, Reply } from '@/components/chat-messages';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { Mascot } from '@/components/mascot';
import { OptionRow } from '@/components/option-row';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';
import { useChooseCustomerMutation } from '@/hooks/data/work-records/use-choose-customer-mutation';
import { useWorkRecordMessageMutation } from '@/hooks/data/work-records/use-work-record-message-mutation';
import { useWorkRecordQuery, type WorkRecord } from '@/hooks/data/work-records/use-work-record-query';
import { formatMoney } from '@/lib/money';
import { firstName } from '@/lib/onboarding';
import { transcriptLines } from '@/lib/transcript';
import { formatWhen } from '@/lib/when';

const paymentMethodLabels = { pix: 'Pix', cash: 'Dinheiro' } as const;
const letters = 'ABCDEFGH';

type Exchange = { id: number; text: string; status: 'sending' | 'done' | 'failed'; newCustomerName?: string | null };

export default function WorkRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workRecord = useWorkRecordQuery(id);

  if (workRecord.isError) {
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
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const placeholder = useCSSVariable('--color-muted-foreground') as string;

  const createdAt = new Date(workRecord.createdAt);
  const working = message.isPending || choose.isPending;
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
                workRecord.customer
                  ? `Registrei o serviço do ${firstName(workRecord.customer.name) ?? workRecord.customer.name}.`
                  : 'Registrei o serviço, mas não entendi de qual cliente é.'
              }
            />
            {workRecord.paid && workRecord.amountCents && (
              <Line text={`Pagamento recebido: ${formatMoney(workRecord.amountCents)}`} />
            )}
            {exchanges.map((exchange) => (
              <View key={exchange.id} className="gap-3">
                <ProfessionalBubble text={exchange.text} />
                {exchange.status === 'done' && (
                  <AssistantReply
                    assistant={billing}
                    text={
                      exchange.newCustomerName
                        ? `Não achei ${exchange.newCustomerName} nos seus clientes. Me passe o WhatsApp com DDD para eu cadastrar.`
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
            ))}
            {working && <Thinking assistant={billing} />}
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
            {/* The team actions (Cobrar no Pix and the like) and their confirmation cards come in here. */}
          </>
        )}
      </ScrollView>

      <View className="px-3" style={{ paddingBottom: bottom + 10 }}>
        <View
          className="flex-row items-end gap-2 rounded-[22px] border border-border bg-card py-2 pr-2 pl-4"
          style={{ borderCurve: 'continuous' }}
        >
          <TextInput
            ref={input}
            className="max-h-32 min-h-9 flex-1 py-2 font-normal text-[15px] text-foreground"
            accessibilityLabel="Mensagem"
            placeholder="Pergunte sobre este serviço"
            placeholderTextColor={placeholder}
            multiline
            value={text}
            onChangeText={setText}
          />
          <Pressable
            className={`size-9 items-center justify-center rounded-full bg-primary ${canSend ? '' : 'opacity-30'}`}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={submit}
          >
            <Icon name="send" size={17} color="--color-primary-foreground" strokeWidth={2.4} />
          </Pressable>
        </View>
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

function Thinking({ assistant }: { assistant: Assistant | undefined }) {
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
      <Text className="font-normal text-muted-foreground text-sm">Pensando</Text>
    </View>
  );
}
