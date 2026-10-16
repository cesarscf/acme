import { Text, View } from 'react-native';
import type { Assistant } from '@/hooks/data/team/use-team-query';
import { type MentionPart, splitMentions } from '@/lib/mentions';
import { Mascot } from './mascot';

type Teammate = Pick<Assistant, 'name' | 'mascot'>;

// An Assistant named in the thread: its mascot and name, in the mention blue.
export function AssistantChip({ assistant }: { assistant: Teammate }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-info py-0.5 pr-2 pl-1">
      <Mascot mascot={assistant.mascot} size={13} />
      <Text className="font-semibold text-[13px] text-mention leading-[17px]">{assistant.name}</Text>
    </View>
  );
}

export function MentionText({ text, team, className }: { text: string; team: Teammate[]; className: string }) {
  const parts = splitMentions(
    text,
    team.map(({ name }) => name),
  );
  return (
    <Text selectable className={className}>
      {parts.map((part, index) => (
        <MentionPartView key={`${index}-${'text' in part ? part.text : part.mention}`} part={part} team={team} />
      ))}
    </Text>
  );
}

function MentionPartView({ part, team }: { part: MentionPart; team: Teammate[] }) {
  if ('text' in part) return part.text;
  const assistant = team.find(({ name }) => name === part.mention)!;
  return (
    <View className="translate-y-[3px]">
      <AssistantChip assistant={assistant} />
    </View>
  );
}
