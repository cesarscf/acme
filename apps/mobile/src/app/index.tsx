import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/lib/api';

export default function Home() {
  const [health, setHealth] = useState('verificando…');

  useEffect(() => {
    api.health.get().then(({ data, error }) => setHealth(data?.status ?? `erro: ${error?.status}`));
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-2 bg-background">
      <Text className="font-bold text-2xl text-foreground">Acme</Text>
      <Text className="text-muted-foreground">API: {health}</Text>
      <View className="mt-4 rounded-lg bg-primary px-6 py-3">
        <Text className="font-bold text-primary-foreground">Começar</Text>
      </View>
    </View>
  );
}
