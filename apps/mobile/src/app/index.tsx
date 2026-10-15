import { Link, router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot';
import { useSignOutMutation } from '@/hooks/data/auth/use-sign-out-mutation';
import { useProfessionalQuery } from '@/hooks/data/professional/use-professional-query';
import { type Assistant, useTeamQuery } from '@/hooks/data/team/use-team-query';
import { useWorkRecordsQuery, type WorkRecordRow } from '@/hooks/data/work-records/use-work-records-query';
import { formatMoney } from '@/lib/money';
import { firstName } from '@/lib/onboarding';
import { formatListTime } from '@/lib/when';

const coachSeenKey = 'acme.home-coach-seen';
const coachTips = [
  { title: 'Seus assistentes', text: 'Toque em um e conte o que ele deve fazer. Ele aprende com você, no chat.' },
  { title: 'Registrar serviço', text: 'Terminou uma visita? Toque aqui e conte o que fez. A equipe cuida do resto.' },
];

export default function Home() {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const { data: team, refetch: refetchTeam } = useTeamQuery();
  const signOut = useSignOutMutation();
  const [tab, setTab] = useState<'assistants' | 'services'>('assistants');
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
    // The recording notice comes up before the first recording, then the recording starts on its own.
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
        <Tab label="Serviços" active={tab === 'services'} onPress={() => setTab('services')} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'assistants' ? <Assistants team={team} /> : <Services />}
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
          <Text className="font-bold text-base text-primary-foreground">Registrar serviço</Text>
        </Pressable>
      </View>

      {tip && (
        <>
          <View className="absolute inset-0 bg-foreground/40" />
          <View
            className="absolute inset-x-5 rounded-[18px] bg-card p-4"
            style={[
              { boxShadow: '0 16px 40px rgba(0,0,0,0.25)', borderCurve: 'continuous' },
              coach === 0 ? { top: top + 150 + assistantRows * 68 } : { bottom: bottom + 104 },
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

// As in a chat app: who it is, what was said last and when.
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

function Services() {
  const { data: workRecords, isError, refetch } = useWorkRecordsQuery();

  if (isError) {
    return (
      <Pressable className="items-center px-10 pt-[90px]" accessibilityRole="button" onPress={() => refetch()}>
        <Text className="text-center font-normal text-destructive text-sm">
          Não conseguimos carregar os serviços. Toque para tentar de novo.
        </Text>
      </Pressable>
    );
  }
  if (!workRecords) return null;
  if (!workRecords.length) {
    return (
      <View className="items-center px-10 pt-[90px]">
        <View className="size-[52px] items-center justify-center rounded-2xl bg-secondary">
          <Icon name="mic" size={24} color="--color-muted-foreground" strokeWidth={1.8} />
        </View>
        <Text className="mt-4 font-bold text-base text-foreground">Nenhum serviço ainda</Text>
        <Text className="mt-1.5 text-center font-normal text-muted-foreground text-sm leading-[21px]">
          Toque em Registrar serviço quando terminar uma visita e conte o que fez. Eu preparo a cobrança, a baixa do
          material e o retorno.
        </Text>
      </View>
    );
  }
  return workRecords.map((workRecord) => <ServiceRow key={workRecord.id} workRecord={workRecord} />);
}

function ServiceRow({ workRecord }: { workRecord: WorkRecordRow }) {
  const detail = [workRecord.title ?? 'Serviço', workRecord.amountCents && formatMoney(workRecord.amountCents)]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link href={{ pathname: '/work-records/[id]', params: { id: workRecord.id } }} asChild>
      <Pressable
        className="min-h-[68px] flex-row items-center gap-3.5 px-5 py-2.5 active:bg-secondary"
        accessibilityHint="Abre o serviço"
      >
        <View className="size-11 items-center justify-center rounded-[14px] bg-secondary">
          <Icon name="wrench" size={22} color="--color-muted-foreground" strokeWidth={1.8} />
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-base text-foreground">
            {workRecord.customerName ?? 'Cliente a definir'}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 font-normal text-muted-foreground text-sm">
            {detail}
          </Text>
        </View>
        <Text
          className={`h-[22px] overflow-hidden rounded-full px-2 font-bold text-[11.5px] leading-[22px] ${
            workRecord.paid ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {workRecord.paid ? 'Pago' : 'A cobrar'}
        </Text>
      </Pressable>
    </Link>
  );
}
