import { Text, View } from 'react-native';
import type { ConversationItem } from '@/hooks/data/conversation/use-conversation-query';
import { Icon } from './icons';
import { OptionRow } from './option-row';

type Confirmation = Extract<ConversationItem, { type: 'confirmation' }>;

export function ConfirmationCard({
  confirmation,
  disabled,
  onDecide,
}: {
  confirmation: Confirmation;
  disabled: boolean;
  onDecide: (confirmed: boolean) => void;
}) {
  return (
    <View className="gap-2.5">
      <View className="overflow-hidden rounded-2xl border border-border bg-card" style={{ borderCurve: 'continuous' }}>
        <View className="flex-row items-center gap-2.5 border-secondary border-b px-4 py-3.5">
          <View className="size-8 items-center justify-center rounded-full border border-border">
            <Icon name="shield" size={16} color="--color-muted-foreground" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-bold text-[14.5px] text-foreground">{confirmation.title}</Text>
            <Text className="font-normal text-[12.5px] text-muted-foreground">{confirmation.subtitle}</Text>
          </View>
        </View>
        <View className="gap-2 px-4 pt-2 pb-3">
          {confirmation.rows.map(({ label, value }) => (
            <Row key={label} label={label} value={value} />
          ))}
          {confirmation.notices.map((notice) => (
            <Row key={notice} label="Aviso" value={notice} />
          ))}
        </View>
      </View>
      {confirmation.status === 'pending' ? (
        <View
          className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
          style={{ borderCurve: 'continuous' }}
        >
          <Text className="px-3.5 pb-3 font-bold text-[15px] text-foreground">{confirmation.question}</Text>
          <OptionRow letter="A" label="Confirmar" strong disabled={disabled} onPress={() => onDecide(true)} />
          <OptionRow letter="B" label="Cancelar" disabled={disabled} onPress={() => onDecide(false)} />
        </View>
      ) : (
        <View className="flex-row items-center justify-center gap-1.5 py-0.5">
          {confirmation.status === 'confirmed' && (
            <Icon name="check" size={14} color="--color-primary" strokeWidth={2.4} />
          )}
          <Text className="font-normal text-[12.5px] text-muted-foreground">
            {confirmation.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
          </Text>
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-3">
      <Text className="w-[84px] font-normal text-[13px] text-muted-foreground leading-5">{label}</Text>
      <Text selectable className="flex-1 font-normal text-[14px] text-foreground leading-5">
        {value}
      </Text>
    </View>
  );
}
