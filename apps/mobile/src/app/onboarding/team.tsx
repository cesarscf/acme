import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Check } from '@/components/check';
import { LoadError } from '@/components/load-error';
import { Mascot } from '@/components/mascot';
import { type CatalogEntry, useCatalogQuery } from '@/hooks/data/catalog/use-catalog-query';
import type { WorkStyle } from '@/hooks/data/professional/use-professional-query';
import { useTeamMutation } from '@/hooks/data/team/use-team-mutation';
import type { Role } from '@/hooks/data/team/use-team-query';
import { selectionFeedback } from '@/lib/haptics';
import { recommendedRoles, teamButtonLabel } from '@/lib/onboarding';

export default function Team() {
  const catalog = useCatalogQuery();
  if (catalog.isError) {
    return <LoadError message="Não conseguimos carregar os assistentes." onRetry={() => catalog.refetch()} />;
  }
  if (!catalog.data) return <View className="flex-1 bg-card" />;
  return <TeamPicker catalog={catalog.data} />;
}

function TeamPicker({ catalog }: { catalog: CatalogEntry[] }) {
  const { top, bottom } = useSafeAreaInsets();
  const { workStyle } = useLocalSearchParams<{ workStyle?: WorkStyle }>();
  const recommended = recommendedRoles(catalog, workStyle ?? null);
  const [chosen, setChosen] = useState(recommended);
  const save = useTeamMutation();

  function toggle(role: Role) {
    selectionFeedback();
    setChosen(chosen.includes(role) ? chosen.filter((other) => other !== role) : [...chosen, role]);
  }

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: top + 18 }}>
      <View className="px-5">
        <BackButton />
        <Text className="mt-[22px] font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
          Monte sua equipe.
        </Text>
        <Text className="mt-2 font-normal text-[15px] text-muted-foreground leading-[22px]">
          Assistentes fazem o trabalho do escritório por você. Já marquei os que combinam com o seu jeito de trabalhar.
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-row flex-wrap justify-between gap-y-2.5 px-5 pt-[18px] pb-3"
        showsVerticalScrollIndicator={false}
      >
        {catalog.map((entry) => (
          <TeamCard
            key={entry.role}
            entry={entry}
            checked={entry.available && chosen.includes(entry.role)}
            recommended={entry.available && recommended.includes(entry.role)}
            onPress={() => entry.available && toggle(entry.role)}
          />
        ))}
      </ScrollView>
      <View className="border-secondary border-t px-5 pt-2.5" style={{ paddingBottom: bottom + 16 }}>
        {save.isError && (
          <Text selectable className="mb-2 font-normal text-destructive text-sm">
            Não conseguimos salvar. Tente de novo.
          </Text>
        )}
        <Button
          label={teamButtonLabel(chosen.length)}
          disabled={!chosen.length}
          loading={save.isPending}
          onPress={() => save.mutate(chosen, { onSuccess: () => router.push('/onboarding/ready') })}
        />
      </View>
    </View>
  );
}

function TeamCard({
  entry: { name, tagline, mascot, available },
  checked,
  recommended,
  onPress,
}: {
  entry: CatalogEntry;
  checked: boolean;
  recommended: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`min-h-[132px] w-[48.5%] rounded-[18px] border-[1.5px] p-3.5 ${checked ? 'border-primary bg-primary/10' : 'border-border bg-background'} ${available ? '' : 'opacity-50'}`}
      style={{ borderCurve: 'continuous' }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !available }}
      accessibilityLabel={`${name}, ${tagline}${available ? '' : ', em breve'}`}
      disabled={!available}
      onPress={onPress}
    >
      <View className="flex-row items-start justify-between">
        <Mascot mascot={mascot} size={34} />
        {available && <Check checked={checked} size={22} />}
      </View>
      <Text className="mt-2.5 font-extrabold text-base text-foreground">{name}</Text>
      <Text className="mt-0.5 font-normal text-[13px] text-muted-foreground leading-[18px]">{tagline}</Text>
      {recommended && (
        <Text className="mt-2 self-start overflow-hidden rounded-full border border-primary/20 bg-card px-2 py-0.5 font-bold text-[11.5px] text-accent-foreground">
          Recomendado
        </Text>
      )}
      {!available && (
        <Text className="mt-2 self-start overflow-hidden rounded-full bg-muted px-2 py-0.5 font-bold text-[11.5px] text-muted-foreground">
          Em breve
        </Text>
      )}
    </Pressable>
  );
}
