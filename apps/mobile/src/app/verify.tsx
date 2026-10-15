import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { authClient } from '@/lib/auth-client';

export default function Verify() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>();

  async function verify(code: string) {
    setVerifying(true);
    setError(undefined);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber, code });
    setVerifying(false);
    if (error?.status === 403) return setError('Muitas tentativas. Volte e peça um código novo.');
    if (error) return setError('Código errado ou vencido. Confira e tente de novo.');
  }

  function changeCode(typed: string) {
    const digits = typed.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  }

  return (
    <View className="flex-1 justify-center gap-1 bg-background px-6">
      <Text className="font-extrabold text-2xl text-foreground">Confirme que é você</Text>
      <Text className="text-muted-foreground">Digite o código de 6 dígitos que chegou no seu WhatsApp.</Text>
      <TextInput
        className="mt-5 h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 text-center font-bold text-2xl text-foreground tracking-[8px]"
        accessibilityLabel="Código de 6 dígitos"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        value={code}
        onChangeText={changeCode}
        autoFocus
      />
      {error && <Text className="mt-2 text-destructive">{error}</Text>}
      <Pressable
        className="mt-4 h-14 items-center justify-center rounded-2xl bg-primary disabled:opacity-30"
        disabled={code.length !== 6 || verifying}
        onPress={() => verify(code)}
      >
        <Text className="font-bold text-base text-primary-foreground">{verifying ? 'Confirmando…' : 'Confirmar'}</Text>
      </Pressable>
    </View>
  );
}
