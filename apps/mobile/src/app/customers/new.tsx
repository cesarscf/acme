import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, type TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { useCreateCustomerMutation } from '@/hooks/data/customers/use-create-customer-mutation';
import { toPhoneNumber } from '@/lib/phone-number';

type ApiError = { status?: number; value?: { customer?: { name: string } } };

export default function NewCustomer() {
  const { bottom } = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');
  const phoneInput = useRef<TextInput>(null);
  const create = useCreateCustomerMutation();
  const phoneNumber = toPhoneNumber(typed);
  const canSave = !!name.trim() && !!phoneNumber;
  const error = create.error as ApiError | null;

  function save() {
    if (canSave && !create.isPending) create.mutate({ name, phoneNumber }, { onSuccess: () => router.back() });
  }

  return (
    <View className="bg-card px-5 pt-6" style={{ paddingBottom: bottom + 20 }}>
      <Text className="font-extrabold text-[19px] text-foreground">Novo cliente</Text>
      <View className="mt-4 gap-3">
        <Field
          accessibilityLabel="Nome do cliente"
          placeholder="Nome"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => phoneInput.current?.focus()}
          autoFocus
        />
        <Field
          ref={phoneInput}
          accessibilityLabel="WhatsApp com DDD"
          placeholder="WhatsApp com DDD"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={save}
        />
      </View>
      {error && (
        <Text selectable className="mt-2 font-normal text-destructive text-sm">
          {error.status === 409
            ? `Esse WhatsApp já é de ${error.value?.customer?.name ?? 'outro cliente'}.`
            : 'Não conseguimos salvar. Tente de novo.'}
        </Text>
      )}
      <Button className="mt-5" label="Salvar" disabled={!canSave} loading={create.isPending} onPress={save} />
    </View>
  );
}
