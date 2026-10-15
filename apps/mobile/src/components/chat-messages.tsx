import { Text, View } from 'react-native';

export function ProfessionalBubble({ text }: { text: string }) {
  return (
    <View className="flex-row justify-end">
      <Text
        selectable
        className="max-w-[82%] overflow-hidden rounded-[18px] rounded-br-md border border-border bg-card px-3.5 py-2.5 font-normal text-[15px] text-foreground leading-[22px]"
      >
        {text}
      </Text>
    </View>
  );
}

export function Reply({ text }: { text: string }) {
  return (
    <Text selectable className="font-normal text-[15.5px] text-foreground leading-[23px]">
      {text}
    </Text>
  );
}
