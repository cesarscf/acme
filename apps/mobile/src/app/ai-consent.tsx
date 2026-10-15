import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Icon } from '@/components/icons';
import { useAiConsentMutation } from '@/hooks/data/professional/use-ai-consent-mutation';

const terms = [
  'Os assistentes usam IA de parceiros para entender e escrever.',
  'Os dados, inclusive dos seus clientes, podem ser processados fora do Brasil.',
];

export default function AiConsent() {
  const { bottom } = useSafeAreaInsets();
  const consent = useAiConsentMutation();

  return (
    <View className="bg-card px-5 pt-6" style={{ paddingBottom: bottom + 8 }}>
      <Text className="font-extrabold text-[22px] text-foreground">Usar IA nas tarefas?</Text>
      <View className="mt-4 gap-3.5">
        {terms.map((term) => (
          <View key={term} className="flex-row items-start gap-3">
            <View className="size-9 items-center justify-center rounded-full bg-secondary">
              <Icon name="shield" size={17} color="--color-muted-foreground" />
            </View>
            <Text className="flex-1 pt-[7px] font-normal text-[14.5px] text-foreground leading-[21px]">{term}</Text>
          </View>
        ))}
      </View>
      {consent.isError && (
        <Text selectable className="mt-4 font-normal text-destructive text-sm">
          Não conseguimos salvar. Tente de novo.
        </Text>
      )}
      <Button
        className="mt-[22px]"
        label="Permitir"
        loading={consent.isPending}
        onPress={() => consent.mutate(undefined, { onSuccess: () => router.back() })}
      />
      <Button className="mt-1" variant="link" label="Agora não" onPress={() => router.back()} />
    </View>
  );
}
