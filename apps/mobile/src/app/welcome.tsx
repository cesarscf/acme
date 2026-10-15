import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Floating } from '@/components/floating';
import { Mascot } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { catalogQuery } from '@/lib/queries';

const spots = [
  { left: 34, top: 64, size: 62 },
  { left: 296, top: 40, size: 52 },
  { left: 300, top: 330, size: 58 },
  { left: 26, top: 340, size: 46 },
  { left: 160, top: 34, size: 40 },
  { left: 160, top: 380, size: 44 },
];

export default function Welcome() {
  const { bottom } = useSafeAreaInsets();
  const { data: catalog } = useQuery(catalogQuery);

  return (
    <View className="flex-1 bg-foreground">
      <View className="h-[470px]">
        {catalog?.slice(0, spots.length).map(({ role, mascot }, index) => (
          <Floating key={role} delay={index * 400} style={{ position: 'absolute', ...spots[index] }}>
            <Mascot mascot={mascot} size={spots[index]!.size} />
          </Floating>
        ))}
        <View className="absolute top-[150px] right-[62px] left-[62px] gap-2">
          <Text className="self-start rounded-[18px] rounded-bl-md bg-background/10 px-3.5 py-2.5 text-[13.5px] text-background">
            Boa tarde! Tem horário amanhã pra limpar o ar?
          </Text>
          <View className="max-w-[230px] self-end rounded-[18px] rounded-br-md bg-card px-3.5 py-2.5">
            <Text className="font-bold text-[11px] text-primary">Lia · Agenda</Text>
            <Text className="text-[13.5px] text-foreground">Tenho às 9h ou às 14h. Qual fica melhor?</Text>
          </View>
        </View>
      </View>
      <View className="flex-1 justify-end gap-2.5 px-[22px]" style={{ paddingBottom: bottom + 24 }}>
        <View className="mb-1.5 flex-row items-center justify-center gap-2">
          <View className="size-[26px] items-center justify-center rounded-lg bg-primary">
            <View className="size-2.5 rounded-[3px] bg-primary-foreground" />
          </View>
          <Text className="font-extrabold text-background text-xl">Acme</Text>
        </View>
        <Text className="text-center font-extrabold text-[28px] text-background leading-[33px]">
          Uma equipe que cuida do escritório enquanto você trabalha.
        </Text>
        <Text className="mb-3.5 text-center text-[15px] text-background/70">
          Assistentes de IA para a rotina do seu serviço.{'\n'}Grátis para começar.
        </Text>
        <PrimaryButton label="Começar" onPress={() => router.push('/sign-in')} />
        <Pressable
          className="h-[54px] items-center justify-center rounded-2xl bg-background/10"
          onPress={() => router.push('/sign-in')}
        >
          <Text className="font-bold text-background text-base">Já tenho conta</Text>
        </Pressable>
      </View>
    </View>
  );
}
