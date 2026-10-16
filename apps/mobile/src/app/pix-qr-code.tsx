import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Button } from '@/components/button';
import { useCustomerThreadQuery } from '@/hooks/data/customers/use-customer-thread-query';
import { qrCodePath } from '@/lib/qr-code';

const qrCodeSize = 200;

export default function PixQrCode() {
  const { customerId, chargeId } = useLocalSearchParams<{ customerId: string; chargeId: string }>();
  const { bottom } = useSafeAreaInsets();
  const { data: thread } = useCustomerThreadQuery(customerId);
  const dark = useCSSVariable('--color-foreground') as string;
  const pix = thread?.items.find((item) => item.type === 'pix' && item.chargeId === chargeId);
  if (pix?.type !== 'pix' || !pix.pixCode) return <View className="h-40 bg-card" />;
  const { size, path } = qrCodePath(pix.pixCode);
  const pixCode = pix.pixCode;

  return (
    <View className="items-center bg-card px-5 pt-6" style={{ paddingBottom: bottom + 8 }}>
      <Text className="font-extrabold text-[19px] text-foreground">Pix · {pix.amount}</Text>
      <Text className="mt-0.5 font-normal text-[13.5px] text-muted-foreground">
        Mostre para o cliente pagar na hora
      </Text>
      <View
        className="my-[18px] rounded-[18px] border border-border bg-card p-3.5"
        style={{ borderCurve: 'continuous' }}
        accessible
        accessibilityRole="image"
        accessibilityLabel="QR Code do Pix"
      >
        <Svg width={qrCodeSize} height={qrCodeSize} viewBox={`0 0 ${size} ${size}`}>
          <Path d={path} fill={dark} />
        </Svg>
      </View>
      <Button
        className="self-stretch"
        variant="secondary"
        label="Copiar código Pix"
        onPress={() => Clipboard.setStringAsync(pixCode).then(() => router.back())}
      />
    </View>
  );
}
