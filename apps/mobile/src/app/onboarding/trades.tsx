import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Check } from '@/components/check';
import { Field } from '@/components/field';
import { api } from '@/lib/api';
import { selectionFeedback } from '@/lib/haptics';
import { searchTrades, trades } from '@/lib/onboarding';
import { meQuery, queryClient, type Trade, unwrap } from '@/lib/queries';

export default function Trades() {
  const { bottom } = useSafeAreaInsets();
  const { data: me } = useQuery(meQuery);
  const [query, setQuery] = useState('');
  const chosen = me?.trades ?? [];
  const found = searchTrades(query);
  const save = useMutation({
    // One PATCH at a time, so quick taps reach the API in order.
    scope: { id: 'trades' },
    mutationFn: (trades: Trade[]) => unwrap(api.me.patch({ trades })),
    onMutate: (trades) => {
      const previous = queryClient.getQueryData(meQuery.queryKey);
      queryClient.setQueryData(meQuery.queryKey, (me) => me && { ...me, trades });
      return { previous };
    },
    onError: (_error, _trades, context) => queryClient.setQueryData(meQuery.queryKey, context?.previous),
  });

  function toggle(trade: Trade) {
    selectionFeedback();
    save.mutate(chosen.includes(trade) ? chosen.filter((other) => other !== trade) : [...chosen, trade]);
  }

  return (
    <View className="flex-1 bg-card px-5 pt-6" style={{ paddingBottom: bottom + 20 }}>
      <Text className="font-extrabold text-[19px] text-foreground">O que você faz</Text>
      <Text className="mt-0.5 font-normal text-muted-foreground text-sm">Marque um ou mais.</Text>
      <Field
        className="mt-3.5 h-[46px] text-[15px]"
        accessibilityLabel="Buscar"
        placeholder="Buscar serviço"
        returnKeyType="search"
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView
        className="my-2 flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {trades
          .filter(({ trade }) => found.includes(trade))
          .map(({ trade, label }) => (
            <Pressable
              key={trade}
              className="min-h-12 flex-row items-center gap-3 border-secondary border-b px-1 py-3 active:bg-background"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen.includes(trade) }}
              onPress={() => toggle(trade)}
            >
              <Text className="flex-1 font-normal text-[15px] text-foreground">{label}</Text>
              <Check checked={chosen.includes(trade)} />
            </Pressable>
          ))}
        {!found.length && (
          <Text className="py-6 text-center font-normal text-muted-foreground text-sm">
            Nada encontrado. Escolha "Outro" se não achar o seu serviço.
          </Text>
        )}
      </ScrollView>
      {save.isError && (
        <Text selectable className="mb-2 font-normal text-destructive text-sm">
          Não conseguimos salvar. Tente de novo.
        </Text>
      )}
      <Button label="Concluído" onPress={() => router.back()} />
    </View>
  );
}
