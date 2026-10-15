import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Button } from '@/components/button';
import { useWorkRecordQuery } from '@/hooks/data/work-records/use-work-record-query';
import { formatMoney } from '@/lib/money';
import { qrCodePath } from '@/lib/qr-code';

const qrCodeSize = 200;

// The prototype's QR sheet: the Customer can pay on the spot by scanning the same Pix sent on WhatsApp.
export default function PixQrCode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bottom } = useSafeAreaInsets();
  const { data: workRecord } = useWorkRecordQuery(id);
  const dark = useCSSVariable('--color-foreground') as string;
  const charge = workRecord?.charge;
  if (!charge?.pixCode) return <View className="h-40 bg-card" />;
  const { size, path } = qrCodePath(charge.pixCode);
  const pixCode = charge.pixCode;

  return (
    <View className="items-center bg-card px-5 pt-6" style={{ paddingBottom: bottom + 8 }}>
      <Text className="font-extrabold text-[19px] text-foreground">Pix · {formatMoney(charge.amountCents)}</Text>
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
