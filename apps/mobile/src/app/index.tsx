import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>();

  useEffect(() => {
    api.me.get().then(({ data }) => setPhoneNumber(data?.phoneNumber));
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-2 bg-background">
      <Text className="font-bold text-2xl text-foreground">Acme</Text>
      <Text className="text-muted-foreground">{phoneNumber ? `Entrou com ${phoneNumber}` : 'Carregando…'}</Text>
      <Pressable className="mt-4 rounded-lg bg-secondary px-6 py-3" onPress={() => authClient.signOut()}>
        <Text className="font-bold text-secondary-foreground">Sair</Text>
      </Pressable>
    </View>
  );
}
