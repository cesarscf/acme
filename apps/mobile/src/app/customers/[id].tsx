import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Fragment, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { CustomerAvatar } from '@/components/customer-avatar';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { StatusPill } from '@/components/status-pill';
import {
  type CustomerThread,
  type ThreadItem,
  useCustomerThreadQuery,
} from '@/hooks/data/customers/use-customer-thread-query';

type Pinned = NonNullable<CustomerThread['pinned']>;
type Item<Type extends ThreadItem['type']> = Extract<ThreadItem, { type: Type }>;

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

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2.5 px-4 pb-2.5" style={{ paddingTop: top + 16 }}>
        <BackButton />
        <View className="min-w-0 shrink flex-row items-center gap-2 rounded-full border border-border bg-card py-[5px] pr-3.5 pl-1.5">
          <CustomerAvatar id={customer.id} name={customer.name} size={28} />
          <View className="min-w-0">
            <Text numberOfLines={1} className="font-bold text-[14.5px] text-foreground leading-[18px]">
              {customer.name}
            </Text>
            <Text numberOfLines={1} className="font-normal text-[11.5px] text-muted-foreground leading-[15px]">
              {customer.phoneNumber}
            </Text>
          </View>
        </View>
      </View>

      {pinned && <PinnedJob pinned={pinned} />}

      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-[18px] pt-2"
        contentContainerStyle={{ paddingBottom: bottom + 16 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {items.map((item) => (
          <ItemView key={item.id} item={item} />
        ))}
      </ScrollView>
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

function ItemView({ item }: { item: ThreadItem }) {
  switch (item.type) {
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
      return <AmountCard icon="pix" tone="accent" amount={item.amount} detail={item.detail} status={item.status} />;
  }
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
}: {
  icon: 'quote' | 'pix';
  tone: 'orange' | 'accent';
  amount: string;
  detail: string;
  status: Item<'quote'>['status'];
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
      <View className="flex-row">
        <StatusPill status={status} />
      </View>
    </View>
  );
}
