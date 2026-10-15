import { reportStatus } from '../../statuses';
import { type DeliveryStatus, type Message, newWamid, nowInSeconds, type Store } from '../../store';
import { contact, envelope, type Webhooks } from '../../webhooks';

type Conversation = Pick<Message, 'phoneNumberId' | 'waId'>;

export function findOutbound(store: Store, id: string) {
  return store.messages.find((message) => message.id === id && message.direction === 'outbound');
}

export function click(store: Store, webhooks: Webhooks, original: Message, index: number) {
  const button = original.buttons[index];
  if (!button || button.kind === 'copy_code') return null;

  const content =
    button.kind === 'reply'
      ? {
          type: 'interactive',
          interactive: { type: 'button_reply', button_reply: { id: button.payload, title: button.text } },
        }
      : { type: 'button', button: { payload: button.payload ?? button.text, text: button.text } };
  return receive(store, webhooks, original, button.text, content, original);
}

export function reply(store: Store, webhooks: Webhooks, conversation: Conversation, text: string) {
  return receive(store, webhooks, conversation, text, { type: 'text', text: { body: text } });
}

export async function report(store: Store, webhooks: Webhooks, message: Message, status: DeliveryStatus) {
  await reportStatus(store, webhooks, message, status);
  return message;
}

export async function resend(store: Store, webhooks: Webhooks, id: string) {
  const message = store.messages.find((message) => message.id === id);
  if (!message?.webhook) return null;
  message.webhook.status = await webhooks.deliver(message.webhook.body);
  store.onChange();
  return message;
}

async function receive(
  store: Store,
  webhooks: Webhooks,
  { phoneNumberId, waId }: Conversation,
  text: string,
  content: Record<string, unknown>,
  original?: Message,
) {
  const id = newWamid();
  const timestamp = nowInSeconds();
  const context = original && { context: { from: original.phoneNumberId, id: original.id } };
  const body = envelope(phoneNumberId, {
    contacts: [contact(waId)],
    messages: [{ ...context, from: waId, id, timestamp: String(timestamp), ...content }],
  });

  const message: Message = {
    id,
    direction: 'inbound',
    phoneNumberId,
    waId,
    timestamp,
    body: text,
    buttons: [],
    contextId: original?.id,
  };
  store.messages.push(message);
  store.onChange();
  message.webhook = { body, status: await webhooks.deliver(body) };
  store.onChange();
  return message;
}
