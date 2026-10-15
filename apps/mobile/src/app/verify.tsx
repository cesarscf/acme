import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { authClient } from '@/lib/auth-client';

const codeLength = 6;

export default function Verify() {
  const { top, bottom } = useSafeAreaInsets();
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const input = useRef<TextInput>(null);
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
    const digits = typed.replace(/\D/g, '').slice(0, codeLength);
    setCode(digits);
    if (digits.length === codeLength) verify(digits);
  }

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: top + 18 }}>
      <BackButton />
      <Text className="mt-7 font-extrabold text-[29px] text-foreground leading-[33px] tracking-[-0.58px]">
        Confirme que é você
      </Text>
      <Text className="mt-2 font-normal text-[15px] text-muted-foreground leading-[22px]">
        Digite o código de 6 dígitos que chegou no seu WhatsApp.
      </Text>
      {/* One hidden input drives the six boxes, so paste and the OS code autofill keep working. */}
      <Pressable
        className="mt-[22px] flex-row gap-2"
        accessibilityLabel="Código de 6 dígitos"
        onPress={() => input.current?.focus()}
      >
        {Array.from({ length: codeLength }, (_, index) => (
          <View
            key={index}
            className={`h-[54px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] ${index === code.length ? 'border-primary' : 'border-input'}`}
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="font-bold text-[22px] text-foreground">{code[index]}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        className="absolute h-px w-px opacity-0"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={codeLength}
        value={code}
        onChangeText={changeCode}
        autoFocus
      />
      {error && (
        <Text selectable className="mt-3 font-normal text-destructive text-sm">
          {error}
        </Text>
      )}
      <View className="flex-1" />
      <KeyboardStickyView offset={{ opened: bottom + 12 }}>
        <View style={{ paddingBottom: bottom + 24 }}>
          <Button
            label="Confirmar"
            disabled={code.length !== codeLength}
            loading={verifying}
            onPress={() => verify(code)}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
