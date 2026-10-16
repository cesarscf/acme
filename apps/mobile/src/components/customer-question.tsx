import { OptionRow } from './option-row';
import { QuestionCard } from './question-card';

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
    <QuestionCard title="De qual cliente é este serviço?">
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
    </QuestionCard>
  );
}
