import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Floating } from '@/components/floating';
import { Mascot } from '@/components/mascot';
import { usePrototypeScale } from '@/lib/layout';
import { firstName } from '@/lib/onboarding';
import { meQuery, queryClient, teamQuery } from '@/lib/queries';

const spots = [
  { left: 40, top: 120 },
  { left: 290, top: 90 },
  { left: 60, top: 560 },
];

export default function Ready() {
  const { bottom } = useSafeAreaInsets();
  const scale = usePrototypeScale();
  const { data: me } = useQuery(meQuery);
  const { data: team } = useQuery(teamQuery);
  const name = me && firstName(me.name);

  async function start() {
    // Home is guarded until the root layout sees the new Team.
    await queryClient.invalidateQueries(teamQuery);
    router.replace('/');
  }

  return (
    <View className="flex-1 bg-card">
      {team?.slice(0, spots.length).map(({ id, mascot }, index) => (
        <Floating
          key={id}
          delay={index * 400}
          style={{ position: 'absolute', left: spots[index]!.left * scale, top: spots[index]!.top * scale }}
        >
          <Mascot mascot={mascot} size={(34 + index * 8) * scale} />
        </Floating>
      ))}
      <View className="flex-1 items-center justify-center px-10">
        <View className="mb-[18px] size-10 items-center justify-center rounded-xl bg-primary">
          <View className="size-[15px] rounded bg-primary-foreground" />
        </View>
        <Text className="text-center font-extrabold text-[29px] text-foreground tracking-[-0.58px]">
          {name ? `Pronto, ${name}!` : 'Pronto!'}
        </Text>
        <Text className="mt-2 max-w-[280px] text-center font-normal text-[15px] text-muted-foreground leading-[22px]">
          Agora é só combinar o trabalho conversando com cada um no chat.
        </Text>
      </View>
      <View className="px-5" style={{ paddingBottom: bottom + 24 }}>
        <Button label="Começar" onPress={start} />
      </View>
    </View>
  );
}
