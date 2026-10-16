import { Text, View } from 'react-native';
import { OptionRow } from './option-row';

const letters = 'ABCDEFGH';

export function CustomerQuestion({
  options,
  disabled,
  onPick,
  onOther,
}: {
  options: { id: string; name: string }[];
  disabled: boolean;
  onPick: (customerId: string) => void;
  onOther: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card pt-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      <Text className="px-3.5 pb-3 font-bold text-[15px] text-foreground leading-[21px]">
        De qual cliente é este serviço?
      </Text>
      {options.map((option, index) => (
        <OptionRow
          key={option.id}
          letter={letters[index]!}
          label={option.name}
          disabled={disabled}
          onPress={() => onPick(option.id)}
        />
      ))}
      <OptionRow
        letter={letters[options.length]!}
        label="Outro"
        hint="Escreva o nome e o WhatsApp aqui embaixo"
        disabled={disabled}
        onPress={onOther}
      />
    </View>
  );
}
