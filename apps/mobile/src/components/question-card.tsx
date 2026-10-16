import { Text, View } from 'react-native';
import type { CatalogEntry } from '@/hooks/data/catalog/use-catalog-query';
import { Mascot } from './mascot';

// A question with lettered options (OptionRow children); asked by an Assistant when one is given.
export function QuestionCard({
  title,
  detail,
  assistant,
  children,
}: {
  title: string;
  detail?: string;
  assistant?: { name: string; mascot: CatalogEntry['mascot'] };
  children: React.ReactNode;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      {assistant && (
        <View className="mb-1 flex-row items-center gap-1.5 px-3.5">
          <Mascot mascot={assistant.mascot} size={18} />
          <Text className="font-bold text-[12.5px] text-foreground">{assistant.name}</Text>
        </View>
      )}
      <View className="px-3.5 pb-3">
        <Text className="font-bold text-[15px] text-foreground leading-[21px]">{title}</Text>
        {detail && <Text className="mt-0.5 font-normal text-[13px] text-muted-foreground">{detail}</Text>}
      </View>
      {children}
    </View>
  );
}
