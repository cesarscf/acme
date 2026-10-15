import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { toPhoneNumber } from '@/lib/phone-number';

export default function SignIn() {
  const [typed, setTyped] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const phoneNumber = toPhoneNumber(typed);

  async function sendCode() {
    if (!phoneNumber) return;
    setSending(true);
    setError(undefined);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
    setSending(false);
    if (error) return setError('Não conseguimos mandar o código. Tente de novo.');
    router.push({ pathname: '/verify', params: { phoneNumber } });
  }

  return (
    <View className="flex-1 justify-center gap-1 bg-background px-6">
      <Text className="font-extrabold text-2xl text-foreground">Seu WhatsApp</Text>
      <Text className="text-muted-foreground">Mandamos um código para entrar. Sem senha.</Text>
      <TextInput
        className="mt-5 h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 text-base text-foreground"
        accessibilityLabel="Número com DDD"
        placeholder="(11) 98765-4321"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={sendCode}
        autoFocus
      />
      {error && <Text className="mt-2 text-destructive">{error}</Text>}
      <Pressable
        className="mt-4 h-14 items-center justify-center rounded-2xl bg-primary disabled:opacity-30"
        disabled={!phoneNumber || sending}
        onPress={sendCode}
      >
        <Text className="font-bold text-base text-primary-foreground">{sending ? 'Enviando…' : 'Enviar código'}</Text>
      </Pressable>
    </View>
  );
}
