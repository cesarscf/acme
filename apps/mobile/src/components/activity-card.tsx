import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { formatWhen } from '@/lib/when';
import { CustomerAvatar } from './customer-avatar';
import { Icon } from './icons';

// What the Assistant did in a Customer's thread; the tap opens that thread on the message, highlighted.
export function ActivityCard({
  customer,
  itemId,
  text,
  at,
}: {
  customer: { id: string; name: string };
  itemId: string;
  text: string;
  at: Date;
}) {
  const first = customer.name.split(' ')[0];
  return (
    <Pressable
      className="flex-row items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 active:bg-secondary"
      style={{ borderCurve: 'continuous' }}
      accessibilityRole="button"
      accessibilityHint={`Abre a conversa do ${first} nessa mensagem`}
      onPress={() => router.push({ pathname: '/customers/[id]', params: { id: customer.id, focus: itemId } })}
    >
      <CustomerAvatar id={customer.id} name={customer.name} size={34} />
      <View className="min-w-0 flex-1">
        <Text className="font-normal text-muted-foreground text-xs">
          <Text className="font-bold text-foreground">{customer.name}</Text> · {formatWhen(new Date(at))}
        </Text>
        <Text numberOfLines={2} className="mt-0.5 font-normal text-foreground text-sm leading-5">
          {text}
        </Text>
        <Text className="mt-1 font-bold text-[12.5px] text-primary">Ver na conversa do {first}</Text>
      </View>
      <Icon name="chevronRight" size={16} color="--color-muted-foreground" />
    </Pressable>
  );
}
