import { Link, router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { CustomerAvatar } from '@/components/customer-avatar';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot';
import { StatusPill } from '@/components/status-pill';
import { useSignOutMutation } from '@/hooks/data/auth/use-sign-out-mutation';
import { type CustomerRow, useCustomersQuery } from '@/hooks/data/customers/use-customers-query';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';
import { firstName } from '@/lib/onboarding';
import { formatListTime } from '@/lib/when';

const coachSeenKey = 'acme.home-coach-seen';
const coachTips = [
  { title: 'Seus assistentes', text: 'Toque em um e conte o que ele deve fazer. Ele aprende com você, no chat.' },
  {
    title: 'Clientes',
    text: 'Cada cliente tem uma conversa com tudo o que aconteceu: visitas, o que você fez, orçamentos e pagamentos.',
  },
  { title: 'Contar o que fiz', text: 'Terminou uma visita? Toque aqui e conte o que fez. A equipe cuida do resto.' },
];

export default function Home() {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const { data: team, refetch: refetchTeam } = useTeamQuery();
  const signOut = useSignOutMutation();
  const [tab, setTab] = useState<'assistants' | 'customers'>('assistants');
  const [coach, setCoach] = useState(() => (SecureStore.getItem(coachSeenKey) ? -1 : 0));
  const recordAfterConsent = useRef(false);
  const name = me && firstName(me.name);

  function confirmSignOut() {
    Alert.alert('Sair da conta?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => signOut.mutate(),
      },
    ]);
  }

  function registerService() {
    if (!me?.aiConsentedAt) {
      recordAfterConsent.current = true;
      router.push({ pathname: '/ai-consent', params: { purpose: 'recording' } });
      return;
    }
    router.push('/work-records/new');
  }

  function nextTip() {
    if (coach < coachTips.length - 1) return setCoach(coach + 1);
    SecureStore.setItem(coachSeenKey, '1');
    setCoach(-1);
  }

  useFocusEffect(
    useCallback(() => {
      if (!recordAfterConsent.current) return;
      recordAfterConsent.current = false;
      if (me?.aiConsentedAt) router.push('/work-records/new');
    }, [me?.aiConsentedAt]),
  );

  // What was said last changes in the conversations and on WhatsApp, so the list catches up on the way back.
  useFocusEffect(
    useCallback(() => {
      refetchTeam();
    }, [refetchTeam]),
  );

  const tip = coachTips[coach];
  const assistantRows = Math.min(team?.length ?? 0, 3);

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: top + 20 }}>
      <View className="flex-row items-center gap-3 px-5 pb-2">
        <Pressable
          className="size-10 items-center justify-center rounded-full border border-border active:bg-secondary"
          accessibilityRole="button"
          accessibilityLabel="Sua conta"
          onPress={confirmSignOut}
        >
          <Text className="font-bold text-muted-foreground text-sm">{name?.[0]?.toUpperCase()}</Text>
        </Pressable>
        <Text className="flex-1 font-extrabold text-[22px] text-foreground tracking-[-0.22px]">
          {name ? `Olá, ${name}` : 'Olá'}
        </Text>
        {/* Creating an Assistant of one's own comes later; the button keeps its place from the prototype. */}
        <Pressable
          className="size-11 items-center justify-center rounded-full border border-border bg-card opacity-40"
          accessibilityRole="button"
          accessibilityLabel="Novo assistente"
          accessibilityState={{ disabled: true }}
          disabled
        >
          <Icon name="plus" size={20} />
        </Pressable>
      </View>
      <View className="mx-5 mt-2.5 mb-2 flex-row gap-1 rounded-[14px] bg-muted p-1">
        <Tab label="Assistentes" active={tab === 'assistants'} onPress={() => setTab('assistants')} />
        <Tab label="Clientes" active={tab === 'customers'} onPress={() => setTab('customers')} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {tab === 'assistants' ? <Assistants team={team} /> : <Customers />}
      </ScrollView>
      <View className="absolute inset-x-0 items-center" style={{ bottom: bottom + 30 }} pointerEvents="box-none">
        <Pressable
          className="h-14 flex-row items-center gap-2.5 rounded-full bg-primary px-[26px] active:opacity-90"
          style={{ boxShadow: '0 10px 24px rgba(14,30,24,0.22)' }}
          accessibilityRole="button"
          accessibilityHint="Conte o que fez numa visita"
          onPress={registerService}
        >
          <Icon name="mic" size={20} color="--color-primary-foreground" />
          <Text className="font-bold text-base text-primary-foreground">Contar o que fiz</Text>
        </Pressable>
      </View>

      {tip && (
        <>
          <View className="absolute inset-0 bg-foreground/40" />
          <View
            className="absolute inset-x-5 rounded-[18px] bg-card p-4"
            style={[
              { boxShadow: '0 16px 40px rgba(0,0,0,0.25)', borderCurve: 'continuous' },
              coach === 0
                ? { top: top + 154 + assistantRows * 68 }
                : coach === 1
                  ? { top: top + 134 }
                  : { bottom: bottom + 104 },
            ]}
          >
            <Text className="font-extrabold text-[15px] text-foreground">{tip.title}</Text>
            <Text className="mt-1 font-normal text-muted-foreground text-sm leading-5">{tip.text}</Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="font-normal text-muted-foreground text-xs">
                {coach + 1} de {coachTips.length}
              </Text>
              <Pressable
                className="h-9 justify-center rounded-full bg-primary px-4 active:opacity-90"
                accessibilityRole="button"
                onPress={nextTip}
              >
                <Text className="font-bold text-primary-foreground text-sm">Próximo</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      className={`h-10 flex-1 items-center justify-center rounded-[11px] ${active ? 'bg-card' : ''}`}
      style={active ? { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
    >
      <Text className={`text-[14.5px] ${active ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function Assistants({ team }: { team: Assistant[] | undefined }) {
  const next = team?.find((assistant) => assistant.playbookStatus === 'draft');
  return (
    <>
      {team?.map((assistant) => (
        <AssistantRow key={assistant.id} assistant={assistant} next={assistant.id === next?.id} />
      ))}
    </>
  );
}

function AssistantRow({ assistant, next }: { assistant: Assistant; next: boolean }) {
  const { lastMessage } = assistant;
  const fresh = !lastMessage && assistant.playbookStatus === 'draft';
  const preview = lastMessage
    ? `${lastMessage.from === 'professional' ? 'Você: ' : ''}${lastMessage.text}`
    : fresh
      ? 'Combine comigo para eu começar'
      : assistant.tagline;
  return (
    <Link href={{ pathname: '/conversation/[id]', params: { id: assistant.id } }} asChild>
      <Pressable
        className="min-h-[68px] flex-row items-center gap-3.5 px-5 py-2.5 active:bg-secondary"
        accessibilityHint="Abre a conversa"
      >
        <Mascot mascot={assistant.mascot} size={40} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="shrink font-bold text-base text-foreground">
              {assistant.name}
              <Text className="font-normal text-muted-foreground"> · {assistant.title}</Text>
            </Text>
            {next && (
              <Text className="h-[22px] overflow-hidden rounded-full bg-primary/10 px-2 font-bold text-[11.5px] text-foreground leading-[22px]">
                Próximo
              </Text>
            )}
          </View>
          <Text
            numberOfLines={1}
            className={`mt-0.5 text-sm ${fresh ? 'font-semibold text-primary' : 'font-normal text-muted-foreground'}`}
          >
            {preview}
          </Text>
        </View>
        <View className="items-end gap-1.5 self-stretch justify-center">
          <Text className="font-normal text-muted-foreground text-xs">
            {formatListTime(new Date(lastMessage?.at ?? assistant.createdAt))}
          </Text>
          {fresh && <View className="size-[9px] rounded-full bg-primary" />}
        </View>
      </Pressable>
    </Link>
  );
}

function Customers() {
  const [query, setQuery] = useState('');
  const placeholder = useCSSVariable('--color-muted-foreground') as string;
  const { data, isLoadingError, refetch } = useCustomersQuery(query.trim());

  // A Visit booked or a Pix paid elsewhere moves a Customer between sections, so the list catches up on the way back.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <>
      <View className="px-5 pt-1 pb-0.5">
        <View className="h-[42px] flex-row items-center gap-2 rounded-xl bg-secondary px-3">
          <Icon name="search" size={17} color="--color-muted-foreground" />
          <TextInput
            className="min-w-0 flex-1 font-normal text-[15px] text-foreground"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar cliente"
            placeholderTextColor={placeholder}
            accessibilityLabel="Buscar cliente"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>
      {isLoadingError ? (
        <Pressable className="items-center px-10 pt-12" accessibilityRole="button" onPress={() => refetch()}>
          <Text className="text-center font-normal text-destructive text-sm">
            Não conseguimos carregar os clientes. Toque para tentar de novo.
          </Text>
        </Pressable>
      ) : data && !data.sections.length ? (
        <Text className="px-10 pt-12 text-center font-normal text-muted-foreground text-sm leading-[21px]">
          {query.trim()
            ? 'Nenhum cliente com esse nome. Quando alguém novo chamar no WhatsApp, ele aparece aqui.'
            : 'Nenhum cliente ainda. Quando alguém chamar no WhatsApp ou você marcar uma visita, ele aparece aqui.'}
        </Text>
      ) : (
        data?.sections.map((section) => (
          <View key={section.key}>
            <Text className="px-5 pt-3.5 pb-0.5 font-bold text-muted-foreground text-xs tracking-[0.48px]">
              {section.title}
            </Text>
            {section.rows.map((row) => (
              <CustomerRowView key={row.id} row={row} today={section.key === 'today'} />
            ))}
          </View>
        ))
      )}
    </>
  );
}

function CustomerRowView({ row, today }: { row: CustomerRow; today: boolean }) {
  return (
    <Link href={{ pathname: '/customers/[id]', params: { id: row.id } }} asChild>
      <Pressable
        className="min-h-[68px] flex-row items-center gap-3 px-5 py-2.5 active:bg-secondary"
        accessibilityHint="Abre a conversa do cliente"
      >
        <CustomerAvatar id={row.id} name={row.name} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 font-bold text-[15.5px] text-foreground">
              {row.name}
            </Text>
            <Text
              className={today ? 'font-bold text-[13px] text-foreground' : 'font-normal text-muted-foreground text-xs'}
            >
              {row.when}
            </Text>
          </View>
          <View className="mt-[3px] flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 font-normal text-[13.5px] text-muted-foreground">
              {row.detail}
            </Text>
            {row.status && <StatusPill status={row.status} />}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
