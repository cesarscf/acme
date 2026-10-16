import { Text } from 'react-native';
import { splitDataMentions } from '@/lib/data-mentions';

// "@agenda" in blue and bold inside the text around it; nested in a Text or a TextInput.
export function DataMentionText({ text }: { text: string }) {
  return splitDataMentions(text).map((part, index) =>
    'mention' in part ? (
      <Text key={`${index}-${part.mention}`} className="font-semibold text-mention">
        {part.mention}
      </Text>
    ) : (
      <Text key={`${index}-${part.text}`}>{part.text}</Text>
    ),
  );
}
