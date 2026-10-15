import { cn } from '@/lib/utils';
import type { Message } from '../../server/store';

export type ConversationKey = { phoneNumberId: string; waId: string };

export function ConversationList({
  conversations,
  selected,
  onSelect,
}: {
  conversations: { key: ConversationKey; last: Message }[];
  selected: ConversationKey | undefined;
  onSelect: (key: ConversationKey) => void;
}) {
  if (conversations.length === 0) return <p className="p-4 text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>;

  return (
    <ul className="flex flex-col">
      {conversations.map(({ key, last }) => (
        <li key={`${key.phoneNumberId}:${key.waId}`}>
          <button
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left hover:bg-muted',
              selected?.phoneNumberId === key.phoneNumberId && selected.waId === key.waId && 'bg-muted',
            )}
          >
            <span className="font-medium text-sm">+{key.waId}</span>
            <span className="text-muted-foreground text-xs">de {key.phoneNumberId}</span>
            <span className="truncate text-muted-foreground text-xs">{last.body}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
