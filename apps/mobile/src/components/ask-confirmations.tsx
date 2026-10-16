import { Text, View } from 'react-native';
import type { ConversationItem } from '@/hooks/data/conversation/use-conversation-query';
import { useAskConfirmationsMutation } from '@/hooks/data/visits/use-ask-confirmations-mutation';
import { ConfirmationCard } from './confirmation-card';

type Confirmation = NonNullable<Extract<ConversationItem, { type: 'agenda' }>['confirmation']>;

// "Pedir confirmação" in Hoje and on the Agenda card: the card listing who is asked, sent all at once on Confirmar.
export function AskConfirmations({ confirmation, onClose }: { confirmation: Confirmation; onClose: () => void }) {
  const ask = useAskConfirmationsMutation();
  return (
    <View className="gap-2">
      <ConfirmationCard
        confirmation={{ id: 'ask-confirmations', type: 'confirmation', status: 'pending', ...confirmation.card }}
        disabled={ask.isPending}
        decisionLine={false}
        onDecide={(confirmed) => (confirmed ? ask.mutate(confirmation.visitIds, { onSuccess: onClose }) : onClose())}
      />
      {ask.isError && (
        <Text selectable className="font-normal text-destructive text-sm">
          Não consegui pedir agora. Tente de novo.
        </Text>
      )}
    </View>
  );
}
