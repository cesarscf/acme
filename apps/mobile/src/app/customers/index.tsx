import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { LoadError } from '@/components/load-error';
import { useCustomersQuery } from '@/hooks/data/customers/use-customers-query';
import { formatPhoneNumber } from '@/lib/phone-number';

export default function Customers() {
  const { top, bottom } = useSafeAreaInsets();
  const customers = useCustomersQuery();

  if (customers.isError) {
    return <LoadError message="Não conseguimos carregar os seus clientes." onRetry={() => customers.refetch()} />;
  }

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: top + 18 }}>
      <View className="flex-row items-center gap-3 px-5">
        <BackButton />
        <Text className="font-extrabold text-[22px] text-foreground tracking-[-0.22px]">Clientes</Text>
      </View>
      <ScrollView className="mt-4 flex-1" showsVerticalScrollIndicator={false}>
        {customers.data?.length === 0 && (
          <Text className="px-5 font-normal text-[15px] text-muted-foreground leading-[22px]">
            Nenhum cliente ainda. Cadastre aqui ou peça para a Lia quando marcar uma visita.
          </Text>
        )}
        {customers.data?.map((customer) => (
          <View key={customer.id} className="min-h-[60px] justify-center border-border border-b px-5 py-2.5">
            <Text className="font-bold text-base text-foreground">{customer.name}</Text>
            <Text selectable className="mt-0.5 font-normal text-muted-foreground text-sm">
              {formatPhoneNumber(customer.phoneNumber)}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View className="px-5 pt-3" style={{ paddingBottom: bottom + 24 }}>
        <Button label="Novo cliente" onPress={() => router.push('/customers/new')} />
      </View>
    </View>
  );
}
