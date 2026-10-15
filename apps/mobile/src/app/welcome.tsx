import { useQuery } from '@tanstack/react-query';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Floating } from '@/components/floating';
import { Mascot } from '@/components/mascot';
import { usePrototypeScale } from '@/lib/layout';
import { catalogQuery } from '@/lib/queries';

const spots = [
  { role: 'scheduling', left: 34, top: 64, size: 62 },
  { role: 'quotes', left: 296, top: 40, size: 52 },
  { role: 'billing', left: 300, top: 330, size: 58 },
  { role: 'inventory', left: 26, top: 340, size: 46 },
  { role: 'tax_receipts', left: 160, top: 34, size: 40 },
  { role: 'routes', left: 160, top: 380, size: 44 },
];

export default function Welcome() {
  const { top, bottom } = useSafeAreaInsets();
  const scale = usePrototypeScale();
  const { data: catalog } = useQuery(catalogQuery);
  // Welcome stays mounted under sign-in, so the light status bar must leave with the focus.
  const focused = useIsFocused();

  return (
    <View className="flex-1 bg-foreground">
      {focused && <StatusBar style="light" />}
      <View style={{ height: 470 * scale, marginTop: top }}>
        {spots.map(({ role, left, top, size }, index) => {
          const entry = catalog?.find((entry) => entry.role === role);
          if (!entry) return null;
          return (
            <Floating
              key={role}
              delay={index * 400}
              style={{ position: 'absolute', left: left * scale, top: top * scale }}
            >
              <Mascot mascot={entry.mascot} size={size * scale} />
            </Floating>
          );
        })}
        <View className="absolute gap-2" style={{ left: 62 * scale, right: 62 * scale, top: 150 * scale }}>
          <View className="self-start rounded-[18px] rounded-bl-md bg-background/10 px-3.5 py-2.5">
            <Text className="font-normal text-[13.5px] text-background leading-[19px]">
              Boa tarde! Tem horário amanhã pra limpar o ar?
            </Text>
          </View>
          <View className="max-w-[230px] self-end rounded-[18px] rounded-br-md bg-card px-3.5 py-2.5">
            <Text className="mb-0.5 font-bold text-[11px] text-primary">Lia · Agenda</Text>
            <Text className="font-normal text-[13.5px] text-foreground leading-[19px]">
              Tenho às 9h ou às 14h. Qual fica melhor?
            </Text>
          </View>
          <View className="flex-row gap-1.5 self-end">
            <Text className="h-7 overflow-hidden rounded-full bg-background/15 px-3 font-bold text-[11.5px] text-background leading-7">
              Aprovar
            </Text>
            <Text className="h-7 overflow-hidden rounded-full bg-background/5 px-3 font-bold text-[11.5px] text-background/70 leading-7">
              Editar
            </Text>
          </View>
        </View>
      </View>
      <View className="flex-1 justify-end gap-2.5 px-[22px]" style={{ paddingBottom: bottom + 24 }}>
        <View className="mb-1.5 flex-row items-center justify-center gap-2">
          <View className="size-[26px] items-center justify-center rounded-lg bg-primary">
            <View className="size-2.5 rounded-[3px] bg-primary-foreground" />
          </View>
          <Text className="font-extrabold text-background text-xl tracking-[-0.4px]">Acme</Text>
        </View>
        <Text className="text-center font-extrabold text-[28px] text-background leading-[33px] tracking-[-0.56px]">
          Uma equipe que cuida do escritório enquanto você trabalha.
        </Text>
        <Text className="mb-3.5 text-center font-normal text-[15px] text-background/70 leading-[22px]">
          Assistentes de IA para a rotina do seu serviço.{'\n'}Grátis para começar.
        </Text>
        <Button label="Começar" onPress={() => router.push('/sign-in')} />
        <Button label="Já tenho conta" variant="glass" onPress={() => router.push('/sign-in')} />
      </View>
    </View>
  );
}
