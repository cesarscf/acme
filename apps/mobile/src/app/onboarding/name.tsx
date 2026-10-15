import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from '@/components/check';
import { PrimaryButton } from '@/components/primary-button';
import { Sheet } from '@/components/sheet';
import { api } from '@/lib/api';
import { searchTrades, trades, tradesSummary } from '@/lib/onboarding';
import { meQuery, type Professional, queryClient, type Trade, unwrap } from '@/lib/queries';

export default function Name() {
  const { data: me } = useQuery(meQuery);
  if (!me) return <View className="flex-1 bg-card" />;
  return <NameForm me={me} />;
}

function NameForm({ me }: { me: Professional }) {
  const { top, bottom } = useSafeAreaInsets();
  const [name, setName] = useState(me.name);
  const [chosen, setChosen] = useState(me.trades);
  const [picking, setPicking] = useState(false);
  const save = useMutation({
    mutationFn: () => unwrap(api.me.patch({ name, trades: chosen })),
    onSuccess: () => {
      queryClient.invalidateQueries(meQuery);
      router.push('/onboarding/work-style');
    },
  });
  const summary = tradesSummary(chosen);

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 18, paddingBottom: bottom + 24 }}>
      <Text className="mt-[72px] font-extrabold text-[29px] text-foreground leading-[33px]">
        Como quer ser chamado?
      </Text>
      <View className="mt-[22px] gap-3">
        <TextInput
          className="h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 text-base text-foreground"
          accessibilityLabel="Seu nome"
          placeholder="Ex.: Carlos da Refrigeração"
          autoComplete="name"
          textContentType="name"
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <Pressable
          className="h-14 flex-row items-center gap-2.5 rounded-2xl border-[1.5px] border-input bg-card px-4"
          accessibilityRole="button"
          accessibilityLabel="O que você faz"
          onPress={() => setPicking(true)}
        >
          <Text
            numberOfLines={1}
            className={`flex-1 text-base ${summary ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {summary ?? 'O que você faz'}
          </Text>
          <Text className="text-muted-foreground">▾</Text>
        </Pressable>
      </View>
      <View className="flex-1" />
      {save.isError && <Text className="mb-2 text-destructive">Não conseguimos salvar. Tente de novo.</Text>}
      <PrimaryButton label="Continuar" disabled={!name.trim() || save.isPending} onPress={() => save.mutate()} />
      <TradeSheet open={picking} onClose={() => setPicking(false)} chosen={chosen} onChange={setChosen} />
    </View>
  );
}

function TradeSheet({
  open,
  onClose,
  chosen,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  chosen: Trade[];
  onChange: (chosen: Trade[]) => void;
}) {
  const [query, setQuery] = useState('');
  const found = searchTrades(query);

  function toggle(trade: Trade) {
    onChange(chosen.includes(trade) ? chosen.filter((other) => other !== trade) : [...chosen, trade]);
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <Text className="font-extrabold text-[19px] text-foreground">O que você faz</Text>
      <Text className="mt-0.5 text-muted-foreground text-sm">Marque um ou mais.</Text>
      <TextInput
        className="mt-3.5 h-[46px] rounded-2xl border-[1.5px] border-input bg-card px-4 text-[15px] text-foreground"
        accessibilityLabel="Buscar"
        placeholder="Buscar serviço"
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView className="my-2 flex-1" keyboardShouldPersistTaps="handled">
        {trades
          .filter(({ trade }) => found.includes(trade))
          .map(({ trade, label }) => (
            <Pressable
              key={trade}
              className="min-h-12 flex-row items-center gap-3 border-border border-b py-3"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen.includes(trade) }}
              onPress={() => toggle(trade)}
            >
              <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
              <Check checked={chosen.includes(trade)} />
            </Pressable>
          ))}
      </ScrollView>
      <PrimaryButton label="Concluído" onPress={onClose} />
    </Sheet>
  );
}
