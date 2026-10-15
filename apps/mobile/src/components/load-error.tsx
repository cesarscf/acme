import { Text, View } from 'react-native';
import { Button } from './button';

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 justify-center gap-4 bg-background px-6">
      <Text selectable className="text-center font-normal text-base text-foreground">
        {message}
      </Text>
      <Button label="Tentar de novo" onPress={onRetry} />
    </View>
  );
}
