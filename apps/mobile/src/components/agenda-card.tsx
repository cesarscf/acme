import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ConversationItem } from '@/hooks/data/conversation/use-conversation-query';
import { AskConfirmations } from './ask-confirmations';
import { Icon } from './icons';
import { StatusPill } from './status-pill';

type Agenda = Extract<ConversationItem, { type: 'agenda' }>;

// The Visits of the period the Assistant read after @agenda; each row opens the Customer's thread.
export function AgendaCard({ agenda }: { agenda: Agenda }) {
  const [asking, setAsking] = useState(false);
  const { confirmation } = agenda;
  return (
    <View className="gap-2.5">
      <View className="overflow-hidden rounded-2xl border border-border bg-card" style={{ borderCurve: 'continuous' }}>
        <View className="flex-row items-center gap-2.5 px-4 pt-3.5 pb-2.5">
          <View className="size-[34px] items-center justify-center rounded-[10px] bg-secondary">
            <Icon name="calendar" size={18} color="--color-muted-foreground" />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-[15px] text-foreground">{agenda.title}</Text>
            <Text className="font-normal text-[12.5px] text-muted-foreground">{agenda.subtitle}</Text>
          </View>
        </View>
        {agenda.rows.map((row) => (
          <Pressable
            key={row.visitId}
            className="min-h-14 flex-row items-center gap-3 border-secondary border-t px-4 py-2.5 active:bg-secondary"
            accessibilityRole="button"
            accessibilityHint="Abre a conversa do cliente"
            onPress={() => router.push({ pathname: '/customers/[id]', params: { id: row.customerId } })}
          >
            <Text className="w-11 font-bold text-[13.5px] text-foreground">{row.when}</Text>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-semibold text-[14.5px] text-foreground">
                {row.customerName}
              </Text>
              <Text numberOfLines={1} className="font-normal text-[12.5px] text-muted-foreground">
                {row.detail}
              </Text>
            </View>
            <StatusPill status={row.status} />
          </Pressable>
        ))}
        <View className="flex-row items-center justify-between border-secondary border-t px-3.5 pt-2.5 pb-3.5">
          {confirmation && !asking ? (
            <Pressable
              className="h-[38px] justify-center rounded-full border border-input px-3.5 active:bg-secondary"
              accessibilityRole="button"
              onPress={() => setAsking(true)}
            >
              <Text className="font-bold text-[13.5px] text-foreground">Pedir confirmação</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            className="min-h-[38px] justify-center active:opacity-60"
            accessibilityRole="button"
            onPress={() => router.dismissTo({ pathname: '/', params: { tab: 'customers' } })}
          >
            <Text className="font-semibold text-[13px] text-muted-foreground">Ver os clientes</Text>
          </Pressable>
        </View>
      </View>
      {confirmation && asking && <AskConfirmations confirmation={confirmation} onClose={() => setAsking(false)} />}
    </View>
  );
}
