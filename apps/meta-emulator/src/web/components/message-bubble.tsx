import { Check, CheckCheck, Copy, RotateCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { emulator } from '@/lib/emulator';
import { cn } from '@/lib/utils';
import type { Message } from '../../server/store';

export function MessageBubble({ message }: { message: Message }) {
  const fromCustomer = message.direction === 'inbound';

  return (
    <div className={cn('flex flex-col gap-1', fromCustomer ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-md rounded-lg px-3 py-2 text-sm shadow-xs',
          fromCustomer ? 'bg-accent text-accent-foreground' : 'bg-card text-card-foreground',
        )}
      >
        {message.header && <p className="font-semibold">{message.header}</p>}
        <p className="whitespace-pre-wrap">{formatBold(message.body)}</p>
        {message.footer && <p className="mt-1 text-muted-foreground text-xs">{message.footer}</p>}
        <p className="mt-1 flex items-center justify-end gap-1 text-muted-foreground text-xs">
          {formatTime(message.timestamp)}
          {message.status && <StatusIcon status={message.status} />}
        </p>
      </div>

      {message.buttons.length > 0 && (
        <div className="flex max-w-md flex-wrap gap-1">
          {message.buttons.map((button, index) =>
            button.kind === 'copy_code' ? (
              <Button
                key={button.text}
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(button.payload ?? '')}
              >
                <Copy /> {button.text}
              </Button>
            ) : (
              <Button
                key={button.text}
                variant="outline"
                size="sm"
                onClick={() => emulator.messages({ id: message.id }).click.post({ index })}
              >
                {button.text}
              </Button>
            ),
          )}
        </div>
      )}

      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        {fromCustomer ? (
          <>
            <WebhookBadge status={message.webhook?.status} />
            <Button variant="ghost" size="xs" onClick={() => emulator.messages({ id: message.id }).resend.post()}>
              <RotateCw /> Reenviar webhook
            </Button>
          </>
        ) : (
          <>
            <span>de {message.phoneNumberId}</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => emulator.messages({ id: message.id }).status.post({ status: 'read' })}
            >
              Marcar como lida
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => emulator.messages({ id: message.id }).status.post({ status: 'failed' })}
            >
              Falhar entrega
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: NonNullable<Message['status']> }) {
  if (status === 'failed') return <X className="size-3.5 text-destructive" aria-label="falhou" />;
  if (status === 'sent') return <Check className="size-3.5" aria-label="enviada" />;
  return (
    <CheckCheck
      className={cn('size-3.5', status === 'read' && 'text-primary')}
      aria-label={status === 'read' ? 'lida' : 'entregue'}
    />
  );
}

function WebhookBadge({ status }: { status: number | null | undefined }) {
  if (status === undefined) return <Badge variant="secondary">webhook enviando…</Badge>;
  if (status === 200) return <Badge variant="secondary">webhook 200</Badge>;
  return <Badge variant="destructive">webhook {status ?? 'sem resposta'}</Badge>;
}

// WhatsApp marks bold text with single asterisks, as in the login code template.
function formatBold(text: string) {
  return text
    .split(/(\*[^*]+\*)/)
    .map((part, index) =>
      part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
        <strong key={index}>{part.slice(1, -1)}</strong>
      ) : (
        part
      ),
    );
}

function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
