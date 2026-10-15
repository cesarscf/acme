import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { authClient } from '@/lib/auth-client';
import { toPhoneNumber } from '@/lib/phone-number';

export default function SignIn() {
  const { top, bottom } = useSafeAreaInsets();
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
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 18 }}>
      <BackButton />
      <Text className="mt-7 font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
        Seu WhatsApp
      </Text>
      <Text className="mt-2 font-normal text-[15px] text-muted-foreground leading-[22px]">
        Mandamos um código para entrar. Sem senha.
      </Text>
      <Field
        className="mt-[22px]"
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
      {error && (
        <Text selectable className="mt-2 font-normal text-destructive text-sm">
          {error}
        </Text>
      )}
      <View className="flex-1" />
      <KeyboardStickyView offset={{ opened: bottom + 12 }}>
        <View style={{ paddingBottom: bottom + 24 }}>
          <Button label="Enviar código" disabled={!phoneNumber} loading={sending} onPress={sendCode} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
