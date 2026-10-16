import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Fragment, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, type TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssistantChip, MentionText } from '@/components/assistant-mention';
import { BackButton } from '@/components/back-button';
import { ProfessionalBubble } from '@/components/chat-messages';
import { Composer } from '@/components/composer';
import { ConfirmationCard } from '@/components/confirmation-card';
import { CustomerAvatar } from '@/components/customer-avatar';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { Mascot } from '@/components/mascot';
import { OptionRow } from '@/components/option-row';
import { StatusPill } from '@/components/status-pill';
import { TeamAction } from '@/components/team-action';
import { useCustomerConfirmationMutation } from '@/hooks/data/customers/use-customer-confirmation-mutation';
import {
  type CustomerThread,
  type ThreadItem,
  useCustomerThreadQuery,
} from '@/hooks/data/customers/use-customer-thread-query';
import { useSendCustomerMessageMutation } from '@/hooks/data/customers/use-send-customer-message-mutation';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { useTeamQuery } from '@/hooks/data/team/use-team-query';
import { withoutOpeningMention } from '@/lib/mentions';

type Pinned = NonNullable<CustomerThread['pinned']>;
type Item<Type extends ThreadItem['type']> = Extract<ThreadItem, { type: Type }>;
type Speaker = Item<'assistant'>['assistant'];
type Message = Parameters<ReturnType<typeof useSendCustomerMessageMutation>['mutate']>[0];

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useCustomerThreadQuery(id);
  const { refetch } = thread;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  if (thread.isLoadingError) {
    return <LoadError message="Não conseguimos abrir a conversa do cliente." onRetry={() => thread.refetch()} />;
  }
  if (!thread.data) return <View className="flex-1 bg-background" />;
  return <Thread thread={thread.data} />;
}

function Thread({ thread }: { thread: CustomerThread }) {
  const { top, bottom } = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const { customer, pinned, items } = thread;
  const { data: me } = useProfessionalQuery();
  const { data: team } = useTeamQuery();
  const speakers: Speaker[] = (team ?? []).map(({ id, name, title, mascot }) => ({ id, name, title, mascot }));
  const send = useSendCustomerMessageMutation(customer.id);
  const decide = useCustomerConfirmationMutation(customer.id);
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const afterConsent = useRef<Message | null>(null);

  const working = send.isPending || decide.isPending || thread.working;
  const draft = send.draft || decide.draft;
  const activity = send.activity ?? decide.activity;
  const answeredBy = team?.find(({ id }) => id === (send.answeredBy ?? decide.answeredBy));
  const failed = (send.isError || decide.isError) && !working;
  // While a card or a question waits for an answer, the actions wait too.
  const waiting = items.some(
    (item) => (item.type === 'confirmation' && item.status === 'pending') || item.type === 'question',
  );
  const canSend = !!text.trim() && !working;

  function sendMessage(message: Message) {
    if (!me?.aiConsentedAt) {
      afterConsent.current = message;
      router.push('/ai-consent');
      return;
    }
    setText('');
    send.mutate(message);
  }

  function record(visitId: string) {
    if (!me?.aiConsentedAt) {
      router.push({ pathname: '/ai-consent', params: { purpose: 'recording' } });
      return;
    }
    router.push({ pathname: '/work-records/new', params: { visitId } });
  }

  function act(message: Message) {
    if (working) return;
    if (!me?.aiConsentedAt) {
      router.push('/ai-consent');
      return;
    }
    send.mutate(message);
  }

  useFocusEffect(
    useCallback(() => {
      const pending = afterConsent.current;
      afterConsent.current = null;
      if (pending && me?.aiConsentedAt) sendMessage(pending);
    }, [me?.aiConsentedAt, sendMessage]),
  );

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <View className="flex-row items-center gap-2.5 px-4 pb-2.5" style={{ paddingTop: top + 16 }}>
        <BackButton />
        <View className="min-w-0 shrink flex-row items-center gap-2 rounded-full border border-border bg-card py-[5px] pr-3.5 pl-1.5">
          <CustomerAvatar id={customer.id} name={customer.name} size={28} />
          <View className="min-w-0">
            <Text numberOfLines={1} className="font-bold text-[14.5px] text-foreground leading-[18px]">
              {customer.name}
            </Text>
            <View className="flex-row items-center gap-[5px]">
              {working && <View className="size-1.5 rounded-full bg-primary" />}
              <Text numberOfLines={1} className="font-normal text-[11.5px] text-muted-foreground leading-[15px]">
                {working ? 'Trabalhando…' : customer.phoneNumber}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {pinned && <PinnedJob pinned={pinned} />}

      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-[18px] pt-2 pb-4"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {items.map((item) =>
          item.type === 'confirmation' ? (
            <ConfirmationCard
              key={item.id}
              confirmation={item}
              disabled={working}
              onDecide={(confirmed) => decide.mutate({ confirmationId: item.id, confirmed })}
            />
          ) : item.type === 'question' ? (
            <Question
              key={item.id}
              item={item}
              disabled={working}
              onAnswer={(answer) => act({ text: answer, role: item.role })}
              onOther={() => input.current?.focus()}
            />
          ) : (
            <ItemView key={item.id} item={item} customerId={customer.id} team={speakers} />
          ),
        )}
        {!!draft && <AssistantReply assistant={answeredBy} text={draft} team={speakers} />}
        {working && !draft && (
          <View
            className="flex-row items-center gap-1.5"
            accessibilityLabel={
              answeredBy ? `${answeredBy.name}: ${activity ?? 'está pensando'}` : 'Vendo quem responde'
            }
          >
            {answeredBy && <AssistantChip assistant={answeredBy} />}
            <Text className="font-normal text-muted-foreground text-sm">
              {answeredBy ? (activity ?? 'está pensando') : 'Vendo quem responde'}
            </Text>
          </View>
        )}
        {failed && (
          <Text selectable className="font-normal text-destructive text-sm">
            Não consegui responder agora. Tente de novo.
          </Text>
        )}
      </ScrollView>

      {thread.actions.length > 0 && (
        <ScrollView
          horizontal
          className="shrink-0 grow-0"
          contentContainerClassName="gap-2 px-4 pt-1 pb-2"
          showsHorizontalScrollIndicator={false}
        >
          {thread.actions.map((action) => {
            const locked = action.done || working || waiting;
            if (action.role === null) {
              return (
                <RecordAction
                  key={action.key}
                  label={action.label}
                  locked={locked}
                  onPress={() => record(action.visitId)}
                />
              );
            }
            const assistant = team?.find(({ role }) => role === action.role);
            if (!assistant) return null;
            return (
              <TeamAction
                key={action.key}
                label={action.label}
                assistant={assistant}
                done={action.done}
                locked={locked}
                onPress={() => act({ text: action.label, role: action.role })}
              />
            );
          })}
        </ScrollView>
      )}

      <View className="px-3" style={{ paddingBottom: bottom + 10 }}>
        <Composer
          inputRef={input}
          value={text}
          onChangeText={setText}
          placeholder={
            working ? 'Escreva uma correção ou o próximo pedido' : `Conte à equipe sobre ${customer.name.split(' ')[0]}`
          }
          canSend={canSend}
          onSend={() => canSend && sendMessage({ text: text.trim() })}
          canListen={!!me?.aiConsentedAt}
          onListenBlocked={() => router.push('/ai-consent')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function AssistantReply({ assistant, text, team }: { assistant?: Speaker; text: string; team: Speaker[] }) {
  return (
    <View>
      {assistant && (
        <View className="mb-1 flex-row items-center gap-1.5">
          <Mascot mascot={assistant.mascot} size={18} />
          <Text className="font-bold text-[12.5px] text-foreground">{assistant.name}</Text>
          <Text className="font-normal text-[12.5px] text-muted-foreground">{assistant.title}</Text>
        </View>
      )}
      <MentionText text={text} team={team} className="font-normal text-[15.5px] text-foreground leading-[23px]" />
    </View>
  );
}

// One Assistant calling a teammate into the thread; the header already names who was called.
function Handoff({ item, team }: { item: Item<'handoff'>; team: Speaker[] }) {
  const request = withoutOpeningMention(
    item.text,
    item.to.name,
    team.map(({ name }) => name),
  );
  return (
    <View className="flex-row gap-2.5">
      <View className="ml-2 w-0.5 rounded-full bg-mention/30" />
      <View className="flex-1 gap-1.5 py-0.5">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Mascot mascot={item.assistant.mascot} size={18} />
          <Text className="font-bold text-[12.5px] text-foreground">{item.assistant.name}</Text>
          <Text className="font-normal text-[12.5px] text-muted-foreground">chamou</Text>
          <AssistantChip assistant={item.to} />
        </View>
        <MentionText text={request} team={team} className="font-normal text-[14.5px] text-foreground leading-[21px]" />
      </View>
    </View>
  );
}

function PinnedJob({ pinned }: { pinned: Pinned }) {
  return (
    <View
      className="mx-4 mb-1.5 rounded-2xl border border-border bg-card px-2.5 pt-2.5 pb-2"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-2 px-1 pb-2">
        <Text className="font-bold text-[11px] text-muted-foreground tracking-[0.44px]">{pinned.label}</Text>
        <Text numberOfLines={1} className="min-w-0 flex-1 font-bold text-[13.5px] text-foreground">
          {pinned.title}
        </Text>
        <StatusPill status={pinned.status} />
      </View>
      <View className="flex-row items-start" accessibilityLabel={describeSteps(pinned.steps)}>
        {pinned.steps.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 && (
              <View
                className={`mt-2.5 h-0.5 flex-1 rounded-full ${step.state === 'done' || step.state === 'current' ? 'bg-primary' : 'bg-border'}`}
              />
            )}
            <View className="w-[66px] items-center gap-1">
              <StepDot state={step.state} />
              <Text
                numberOfLines={1}
                className={`text-[11.5px] ${
                  step.state === 'current'
                    ? 'font-bold text-foreground'
                    : step.state === 'done'
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-muted-foreground'
                }`}
              >
                {step.label}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const stepNames = { done: 'feito', current: 'agora', todo: 'falta', optional: 'opcional', skipped: 'pulado' } as const;

function describeSteps(steps: Pinned['steps']) {
  return steps.map(({ label, state }) => `${label}: ${stepNames[state]}`).join(', ');
}

function StepDot({ state }: { state: Pinned['steps'][number]['state'] }) {
  if (state === 'done') {
    return (
      <View className="size-[22px] items-center justify-center rounded-full bg-primary">
        <Icon name="check" size={12} color="--color-primary-foreground" strokeWidth={3.2} />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View className="size-[22px] items-center justify-center">
        <View className="absolute -inset-1 rounded-full bg-primary/10" />
        <View className="size-[22px] rounded-full border-2 border-primary bg-card" />
      </View>
    );
  }
  if (state === 'skipped') {
    return (
      <View className="size-[22px] items-center justify-center rounded-full bg-secondary">
        <View className="h-0.5 w-2 rounded-full bg-muted-foreground/60" />
      </View>
    );
  }
  return (
    <View
      className={`size-[22px] rounded-full border-[1.5px] bg-card ${state === 'optional' ? 'border-dashed border-input' : 'border-input'}`}
    />
  );
}

function ItemView({
  item,
  customerId,
  team,
}: {
  item: Exclude<ThreadItem, { type: 'confirmation' | 'question' }>;
  customerId: string;
  team: Speaker[];
}) {
  switch (item.type) {
    case 'line':
      return <Line text={item.text} />;
    case 'professional':
      return <ProfessionalBubble text={item.text} />;
    case 'assistant':
      return <AssistantReply assistant={item.assistant} text={item.text} team={team} />;
    case 'handoff':
      return <Handoff item={item} team={team} />;
    case 'day':
      return <DayDivider label={item.label} />;
    case 'job_start':
      return <JobStart title={item.title} />;
    case 'past_job':
      return <PastJob item={item} />;
    case 'visit':
      return <VisitCard item={item} />;
    case 'work_record':
      return <WorkRecordCard item={item} />;
    case 'quote':
      return <AmountCard icon="quote" tone="orange" amount={item.total} detail={item.detail} status={item.status} />;
    case 'pix':
      return (
        <AmountCard
          icon="pix"
          tone="accent"
          amount={item.amount}
          detail={item.detail}
          status={item.status}
          onShowQrCode={
            item.pixCode
              ? () => router.push({ pathname: '/pix-qr-code', params: { customerId, chargeId: item.chargeId } })
              : undefined
          }
        />
      );
    case 'whatsapp':
      return <WhatsappBubble item={item} />;
  }
}

// Sent to the Customer on the right in green, with the buttons they got; what they sent on the left in white.
function WhatsappBubble({ item }: { item: Item<'whatsapp'> }) {
  const outbound = item.direction === 'outbound';
  return (
    <View className={`flex-row ${outbound ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[84%] border px-3 py-2 ${
          outbound
            ? 'rounded-t-[14px] rounded-bl-[14px] rounded-br-[4px] border-whatsapp-border bg-whatsapp'
            : 'rounded-t-[14px] rounded-br-[14px] rounded-bl-[4px] border-border bg-card'
        }`}
      >
        <View className="flex-row items-center gap-[5px]">
          <Icon name="whatsapp" size={12} color="--color-accent-foreground" strokeWidth={2.2} />
          <Text className="font-bold text-[11.5px] text-accent-foreground">{item.label}</Text>
        </View>
        <Text selectable className="mt-[3px] font-normal text-foreground text-sm leading-5">
          {item.text}
        </Text>
        {item.buttons.length > 0 && (
          <View className="mt-2 flex-row gap-1.5">
            {item.buttons.map((button) => (
              <Text
                key={button}
                numberOfLines={1}
                className="flex-1 overflow-hidden rounded-[10px] border border-whatsapp-border bg-card px-1 py-1.5 text-center font-bold text-[12.5px] text-accent-foreground"
              >
                {button}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-2 py-1">
      <View className="h-px flex-1 bg-border" />
      <Text className="font-normal text-[12.5px] text-muted-foreground">{label}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

function JobStart({ title }: { title: string }) {
  return (
    <View className="flex-row items-center gap-2 pt-1.5 pb-0.5">
      <View className="h-px flex-1 bg-input" />
      <Text numberOfLines={1} className="shrink font-bold text-foreground/80 text-xs tracking-[0.24px]">
        Novo atendimento · {title}
      </Text>
      <View className="h-px flex-1 bg-input" />
    </View>
  );
}

function PastJob({ item }: { item: Item<'past_job'> }) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="size-9 items-center justify-center rounded-[11px] bg-accent">
        <Icon name="check" size={17} color="--color-accent-foreground" strokeWidth={2.4} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-[11px] text-muted-foreground tracking-[0.44px]">ATENDIMENTO · {item.date}</Text>
        <Text className="mt-0.5 font-bold text-[14.5px] text-foreground">{item.title}</Text>
        {!!item.detail && <Text className="mt-px font-normal text-[12.5px] text-muted-foreground">{item.detail}</Text>}
      </View>
      <StatusPill status={item.status} />
    </View>
  );
}

function VisitCard({ item }: { item: Item<'visit'> }) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="size-10 items-center justify-center rounded-xl bg-info" style={{ borderCurve: 'continuous' }}>
        <Icon name="calendar" size={19} color="--color-info-foreground" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-[14.5px] text-foreground">{item.title}</Text>
        <Text className="mt-px font-normal text-[12.5px] text-muted-foreground">{item.detail}</Text>
      </View>
      <StatusPill status={item.status} />
    </View>
  );
}

function WorkRecordCard({ item }: { item: Item<'work_record'> }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center justify-between gap-2 px-4 pt-3.5 pb-1">
        <Text className="font-extrabold text-[15.5px] text-foreground">{item.label}</Text>
        <Text className="h-[22px] overflow-hidden rounded-full bg-secondary px-2 font-bold text-[11.5px] text-muted-foreground leading-[22px]">
          {item.when}
        </Text>
      </View>
      <View className="px-4 pt-1 pb-1.5">
        {item.rows.map(({ label, value }) => (
          <View key={label} className="flex-row gap-2.5 py-[7px]">
            <Text className="w-24 font-normal text-muted-foreground text-sm leading-5">{label}</Text>
            <Text selectable className="flex-1 font-normal text-foreground text-sm leading-5">
              {value}
            </Text>
          </View>
        ))}
      </View>
      {open && (
        <View className="mx-4 mb-1.5 gap-1.5 rounded-xl bg-background px-3 py-2.5">
          {item.transcript.map((line, index) => (
            <Text key={`${index}-${line}`} selectable className="font-normal text-[13.5px] text-foreground leading-5">
              {line}
            </Text>
          ))}
        </View>
      )}
      <View className="border-secondary border-t px-1.5">
        <Pressable
          className="min-h-11 justify-center self-start px-3 active:opacity-60"
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
        >
          <Text className="font-semibold text-[13.5px] text-muted-foreground">
            {open ? 'Esconder o que você disse' : 'Ver o que você disse'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AmountCard({
  icon,
  tone,
  amount,
  detail,
  status,
  onShowQrCode,
}: {
  icon: 'quote' | 'pix';
  tone: 'orange' | 'accent';
  amount: string;
  detail: string;
  status: Item<'quote'>['status'];
  onShowQrCode?: () => void;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card px-4 py-3.5" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center gap-3">
        <View
          className={`size-10 items-center justify-center rounded-xl ${tone === 'orange' ? 'bg-orange' : 'bg-accent'}`}
          style={{ borderCurve: 'continuous' }}
        >
          <Icon
            name={icon}
            size={20}
            color={tone === 'orange' ? '--color-orange-foreground' : '--color-accent-foreground'}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-extrabold text-[18px] text-foreground">{amount}</Text>
          <Text className="font-normal text-[12.5px] text-muted-foreground">{detail}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <StatusPill status={status} />
        {onShowQrCode && (
          <Pressable
            className="h-[38px] items-center justify-center rounded-full border border-input px-3.5 active:bg-secondary"
            accessibilityRole="button"
            onPress={onShowQrCode}
          >
            <Text className="font-bold text-[13.5px] text-foreground">Mostrar QR Code</Text>
          </Pressable>
        )}
      </View>
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

// A question with options; the answer goes to the Assistant who asked, as if typed. "Outro" opens the field.
function Question({
  item,
  disabled,
  onAnswer,
  onOther,
}: {
  item: Item<'question'>;
  disabled: boolean;
  onAnswer: (answer: string) => void;
  onOther: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="mb-1 flex-row items-center gap-1.5 px-3.5">
        <Mascot mascot={item.assistant.mascot} size={18} />
        <Text className="font-bold text-[12.5px] text-foreground">{item.assistant.name}</Text>
      </View>
      <Text className="px-3.5 pb-3 font-bold text-[15px] text-foreground leading-[21px]">{item.text}</Text>
      {item.options.map((option, index) => (
        <OptionRow
          key={option.label}
          letter={'ABCD'[index]!}
          label={option.label}
          hint={option.hint}
          strong={index === 0}
          disabled={disabled}
          onPress={() => (option.other ? onOther() : onAnswer(option.label))}
        />
      ))}
    </View>
  );
}

// "Contar como foi" records the Visit by audio; nobody on the team does it.
function RecordAction({ label, locked, onPress }: { label: string; locked: boolean; onPress: () => void }) {
  return (
    <Pressable
      className={`rounded-2xl border border-border bg-card px-3.5 py-2.5 ${locked ? 'opacity-50' : ''}`}
      style={{ borderCurve: 'continuous' }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, por áudio`}
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      onPress={onPress}
    >
      <Text className="font-bold text-foreground text-sm">{label}</Text>
      <View className="mt-1 flex-row items-center gap-[5px]">
        <Icon name="mic" size={14} color="--color-muted-foreground" />
        <Text className="font-normal text-muted-foreground text-xs">por áudio</Text>
      </View>
    </Pressable>
  );
}
