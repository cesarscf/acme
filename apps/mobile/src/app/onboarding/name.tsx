import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icons';
import { LoadError } from '@/components/load-error';
import { api } from '@/lib/api';
import { tradesSummary } from '@/lib/onboarding';
import { meQuery, type Professional, queryClient, unwrap } from '@/lib/queries';

export default function Name() {
  const me = useQuery(meQuery);
  if (me.isError) return <LoadError message="Não conseguimos carregar o seu perfil." onRetry={() => me.refetch()} />;
  if (!me.data) return <View className="flex-1 bg-card" />;
  return <NameForm me={me.data} />;
}

function NameForm({ me }: { me: Professional }) {
  const { top, bottom } = useSafeAreaInsets();
  const [name, setName] = useState(me.name);
  const save = useMutation({
    mutationFn: () => unwrap(api.me.patch({ name })),
    onSuccess: () => {
      queryClient.invalidateQueries(meQuery);
      router.push('/onboarding/work-style');
    },
  });
  // The Trades sheet saves straight to the profile, so the summary follows the cached Professional.
  const summary = tradesSummary(me.trades);

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 18 }}>
      <Text className="mt-[72px] font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
        Como quer ser chamado?
      </Text>
      <View className="mt-[22px] gap-3">
        <Field
          accessibilityLabel="Seu nome"
          placeholder="Ex.: Carlos da Refrigeração"
          autoComplete="name"
          textContentType="name"
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <Pressable
          className="h-14 flex-row items-center gap-2.5 rounded-2xl border-[1.5px] border-input bg-card px-4 active:bg-secondary"
          style={{ borderCurve: 'continuous' }}
          accessibilityRole="button"
          accessibilityLabel="O que você faz"
          accessibilityValue={summary ? { text: summary } : undefined}
          onPress={() => router.push('/onboarding/trades')}
        >
          <Icon name="wrench" color="--color-muted-foreground" strokeWidth={1.8} />
          <Text
            numberOfLines={1}
            className={`flex-1 font-normal text-base ${summary ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {summary ?? 'O que você faz'}
          </Text>
          <Icon name="chevronDown" size={18} color="--color-muted-foreground" />
        </Pressable>
      </View>
      <View className="flex-1" />
      <KeyboardStickyView offset={{ opened: bottom + 12 }}>
        <View style={{ paddingBottom: bottom + 24 }}>
          {save.isError && (
            <Text selectable className="mb-2 font-normal text-destructive text-sm">
              Não conseguimos salvar. Tente de novo.
            </Text>
          )}
          <Button label="Continuar" disabled={!name.trim()} loading={save.isPending} onPress={() => save.mutate()} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
