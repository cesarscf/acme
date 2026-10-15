import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Check } from '@/components/check';
import { PrimaryButton } from '@/components/primary-button';
import { api } from '@/lib/api';
import { workStyles } from '@/lib/onboarding';
import { meQuery, queryClient, unwrap, type WorkStyle } from '@/lib/queries';

export default function WorkStyleScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useQuery(meQuery);
  const [chosen, setChosen] = useState(me?.workStyle ?? undefined);
  const save = useMutation({
    mutationFn: (workStyle: WorkStyle | null) => unwrap(api.me.patch({ workStyle })),
    onSuccess: (_, workStyle) => {
      queryClient.invalidateQueries(meQuery);
      router.push({ pathname: '/onboarding/team', params: workStyle ? { workStyle } : {} });
    },
  });

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 18, paddingBottom: bottom + 16 }}>
      <BackButton />
      <Text className="mt-7 font-extrabold text-[29px] text-foreground leading-[33px]">Como você trabalha hoje?</Text>
      <Text className="mt-2 text-[15px] text-muted-foreground">Assim eu monto a equipe certa para você.</Text>
      <View className="mt-[22px] gap-2.5">
        {workStyles.map(({ workStyle, title, description, people }) => {
          const on = chosen === workStyle;
          return (
            <Pressable
              key={workStyle}
              className={`min-h-[76px] flex-row items-center gap-3 rounded-[18px] border-[1.5px] px-4 py-3.5 ${on ? 'border-primary bg-accent' : 'border-border bg-card'}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setChosen(workStyle)}
            >
              <View className="h-11 w-[54px] flex-row items-end justify-center gap-[3px]">
                {Array.from({ length: people }, (_, index) => (
                  <View
                    key={index}
                    className={`rounded-t-lg rounded-b ${index === 0 ? 'h-[26px] w-4 bg-primary' : 'h-[21px] w-[13px] bg-input'}`}
                  />
                ))}
              </View>
              <View className="flex-1">
                <Text className="font-bold text-base text-foreground">{title}</Text>
                <Text className="mt-0.5 text-[13.5px] text-muted-foreground">{description}</Text>
              </View>
              <Check checked={on} />
            </Pressable>
          );
        })}
      </View>
      <View className="flex-1" />
      {save.isError && <Text className="mb-2 text-destructive">Não conseguimos salvar. Tente de novo.</Text>}
      <PrimaryButton label="Continuar" disabled={!chosen || save.isPending} onPress={() => save.mutate(chosen!)} />
      <Pressable
        className="min-h-11 items-center justify-center self-center p-3"
        disabled={save.isPending}
        onPress={() => save.mutate(null)}
      >
        <Text className="font-bold text-[15px] text-foreground">Pular</Text>
      </Pressable>
    </View>
  );
}
