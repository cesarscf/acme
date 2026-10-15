import { useState } from 'react';
import { Conversation } from '@/components/conversation';
import { type ConversationKey, ConversationList } from '@/components/conversation-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { emulator } from '@/lib/emulator';
import { useMessages } from '@/lib/use-messages';

export function App() {
  const { messages, connected } = useMessages();
  const [selected, setSelected] = useState<ConversationKey>();
  const [verification, setVerification] = useState<string>();

  const conversations = Map.groupBy(messages, (message) => `${message.phoneNumberId}:${message.waId}`)
    .values()
    .map((thread) => ({
      key: { phoneNumberId: thread[0]!.phoneNumberId, waId: thread[0]!.waId },
      last: thread.at(-1)!,
    }))
    .toArray()
    .sort((a, b) => b.last.timestamp - a.last.timestamp);
  const current = selected ?? conversations[0]?.key;

  async function verify() {
    const { data } = await emulator.webhook.verify.post();
    setVerification(data?.verified ? 'Webhook verificado' : `Verificação falhou (${data?.status ?? 'sem resposta'})`);
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <h1 className="font-bold text-lg">Meta Emulator</h1>
        <Badge variant={connected ? 'secondary' : 'destructive'}>{connected ? 'conectado' : 'desconectado'}</Badge>
        <div className="ml-auto flex items-center gap-2">
          {verification && <span className="text-muted-foreground text-sm">{verification}</span>}
          <Button variant="outline" size="sm" onClick={verify}>
            Verificar webhook
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r bg-card">
          <ConversationList conversations={conversations} selected={current} onSelect={setSelected} />
        </aside>
        {current ? (
          <Conversation
            {...current}
            messages={messages.filter((m) => m.phoneNumberId === current.phoneNumberId && m.waId === current.waId)}
          />
        ) : (
          <p className="m-auto text-muted-foreground">Envie uma mensagem pela Graph API para começar.</p>
        )}
      </div>
    </div>
  );
}
