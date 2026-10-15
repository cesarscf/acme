import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, whatsappMessageStatus, whatsappMessages, type whatsappOriginType } from '@acme/db';
import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';
import type { InboundMessage, StatusUpdate, Webhook } from './model';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type WhatsappMessage = typeof whatsappMessages.$inferSelect;

export type OriginType = (typeof whatsappOriginType.enumValues)[number];
export type Origin = { type: OriginType; id: string };
export type ButtonClick = {
  originId: string;
  button: { payload: string; text: string };
  message: WhatsappMessage;
  tx: Transaction;
};

type TextParameter = { type: 'text'; text: string };
type TemplateComponent =
  | { type: 'header' | 'body'; parameters: TextParameter[] }
  | { type: 'button'; sub_type: 'quick_reply'; index: string; parameters: { type: 'payload'; payload: string }[] };

export type OutboundMessage =
  | { type: 'text'; text: { body: string; preview_url?: boolean } }
  | {
      type: 'template';
      template: { name: string; language: { code: string }; components?: TemplateComponent[] };
    }
  | {
      type: 'interactive';
      interactive: {
        type: 'button';
        header?: TextParameter;
        body: { text: string };
        footer?: { text: string };
        action: { buttons: { type: 'reply'; reply: { id: string; title: string } }[] };
      };
    };

type GraphSendResult = { contacts: { wa_id: string }[]; messages: { id: string }[] };

const buttonHandlers: Partial<Record<OriginType, (click: ButtonClick) => unknown>> = {};

export function onButtonClick(type: OriginType, handler: (click: ButtonClick) => unknown) {
  buttonHandlers[type] = handler;
}

export async function sendMessage({
  from,
  to,
  message,
  origin,
}: {
  from: string;
  to: string;
  message: OutboundMessage;
  origin?: Origin;
}) {
  const response = await fetch(`${env('META_GRAPH_URL')}/${from}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('META_ACCESS_TOKEN')}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...message }),
  });
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: { message: string } };
    throw new Error(`WhatsApp send failed: ${error?.message ?? response.status}`);
  }
  const { contacts, messages } = (await response.json()) as GraphSendResult;

  const [stored] = await db
    .insert(whatsappMessages)
    .values({
      wamid: messages[0]!.id,
      direction: 'outbound',
      phoneNumberId: from,
      waId: contacts[0]!.wa_id,
      type: message.type,
      text:
        message.type === 'text'
          ? message.text.body
          : message.type === 'interactive'
            ? message.interactive.body.text
            : null,
      payload: message,
      originType: origin?.type,
      originId: origin?.id,
      sentAt: new Date(),
    })
    .returning();
  return stored!;
}

export function listMessages({ phoneNumberId, waId }: { phoneNumberId: string; waId: string }) {
  return db
    .select()
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.phoneNumberId, phoneNumberId), eq(whatsappMessages.waId, waId)))
    .orderBy(asc(whatsappMessages.sentAt), asc(whatsappMessages.createdAt));
}

export function isVerifiedSubscription(mode: string, verifyToken: string) {
  return mode === 'subscribe' && verifyToken === env('META_VERIFY_TOKEN');
}

export function isSignedByMeta(body: string, signature: string | undefined) {
  const expected = Buffer.from(`sha256=${createHmac('sha256', env('META_APP_SECRET')).update(body).digest('hex')}`);
  const received = Buffer.from(signature ?? '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function receiveWebhook(webhook: Webhook) {
  for (const entry of webhook.entry) {
    for (const { field, value } of entry.changes) {
      if (field !== 'messages' || !value.metadata) continue;
      for (const message of value.messages ?? []) await receiveMessage(value.metadata.phone_number_id, message);
      for (const status of value.statuses ?? []) await updateStatus(status);
    }
  }
}

async function receiveMessage(phoneNumberId: string, message: InboundMessage) {
  const button = clickedButton(message);
  await db.transaction(async (tx) => {
    const repliedTo = message.context
      ? await tx.query.whatsappMessages.findFirst({ where: eq(whatsappMessages.wamid, message.context.id) })
      : undefined;
    const [stored] = await tx
      .insert(whatsappMessages)
      .values({
        wamid: message.id,
        direction: 'inbound',
        phoneNumberId,
        waId: message.from,
        type: message.type,
        text: message.text?.body ?? button?.text,
        payload: message,
        contextWamid: message.context?.id,
        originType: repliedTo?.originType,
        originId: repliedTo?.originId,
        sentAt: new Date(Number(message.timestamp) * 1000),
      })
      .onConflictDoNothing({ target: whatsappMessages.wamid })
      .returning();
    if (!stored || !button || !repliedTo?.originType || !repliedTo.originId) return;
    await buttonHandlers[repliedTo.originType]?.({ originId: repliedTo.originId, button, message: stored, tx });
  });
}

async function updateStatus({ id, status, errors }: StatusUpdate) {
  const deliveryStatus = whatsappMessageStatus.enumValues.find((value) => value === status);
  if (!deliveryStatus) return;
  // Meta may deliver statuses out of order (read before delivered), so a status only replaces an earlier one.
  await db
    .update(whatsappMessages)
    .set({ status: deliveryStatus, ...(errors && { errors }) })
    .where(
      and(
        eq(whatsappMessages.wamid, id),
        or(isNull(whatsappMessages.status), lt(whatsappMessages.status, deliveryStatus)),
      ),
    );
}

function clickedButton({ button, interactive }: InboundMessage) {
  if (button) return { payload: button.payload, text: button.text };
  const reply = interactive?.button_reply;
  if (reply) return { payload: reply.id, text: reply.title };
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
