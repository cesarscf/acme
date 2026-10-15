import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Check } from '@/components/check';
import { useProfessionalMutation } from '@/hooks/data/professional/use-professional-mutation';
import { useProfessionalQuery, type WorkStyle } from '@/hooks/data/professional/use-professional-query';
import { selectionFeedback } from '@/lib/haptics';
import { workStyles } from '@/lib/onboarding';

export default function WorkStyleScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { data: me } = useProfessionalQuery();
  const [chosen, setChosen] = useState(me?.workStyle ?? undefined);
  const save = useProfessionalMutation();

  function saveAndContinue(workStyle: WorkStyle | null) {
    save.mutate(
      { workStyle },
      { onSuccess: () => router.push({ pathname: '/onboarding/team', params: workStyle ? { workStyle } : {} }) },
    );
  }

  function choose(workStyle: WorkStyle) {
    selectionFeedback();
    setChosen(workStyle);
  }

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 18, paddingBottom: bottom + 16 }}>
      <BackButton />
      <Text className="mt-7 font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
        Como você trabalha hoje?
      </Text>
      <Text className="mt-2 font-normal text-[15px] text-muted-foreground leading-[22px]">
        Assim eu monto a equipe certa para você.
      </Text>
      <View className="mt-[22px] gap-2.5" accessibilityRole="radiogroup">
        {workStyles.map(({ workStyle, title, description, people }) => {
          const on = chosen === workStyle;
          return (
            <Pressable
              key={workStyle}
              className={`min-h-[76px] flex-row items-center gap-3 rounded-[18px] border-[1.5px] px-4 py-3.5 ${on ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              style={{ borderCurve: 'continuous' }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => choose(workStyle)}
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
                <Text className="mt-0.5 font-normal text-[13.5px] text-muted-foreground">{description}</Text>
              </View>
              <Check checked={on} />
            </Pressable>
          );
        })}
      </View>
      <View className="flex-1" />
      {save.isError && (
        <Text selectable className="mb-2 font-normal text-destructive text-sm">
          Não conseguimos salvar. Tente de novo.
        </Text>
      )}
      <Button
        label="Continuar"
        disabled={!chosen}
        loading={save.isPending && save.variables?.workStyle !== null}
        onPress={() => saveAndContinue(chosen!)}
      />
      <Button
        label="Pular"
        variant="link"
        loading={save.isPending && save.variables?.workStyle === null}
        onPress={() => saveAndContinue(null)}
      />
    </View>
  );
}
