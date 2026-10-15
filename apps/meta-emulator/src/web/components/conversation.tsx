import { SendHorizontal } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { MessageBubble } from '@/components/message-bubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emulator } from '@/lib/emulator';
import type { Message } from '../../server/store';

export function Conversation({
  phoneNumberId,
  waId,
  messages,
}: {
  phoneNumberId: string;
  waId: string;
  messages: Message[];
}) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await emulator.conversations({ phoneNumberId })({ waId }).messages.post({ text });
    setText('');
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="border-b bg-card px-4 py-3">
        <p className="font-semibold">+{waId}</p>
        <p className="text-muted-foreground text-xs">Número do negócio: {phoneNumberId}</p>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t bg-card p-3">
        <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Responder como o Cliente" />
        <Button type="submit" size="icon" aria-label="Enviar">
          <SendHorizontal />
        </Button>
      </form>
    </section>
  );
}
