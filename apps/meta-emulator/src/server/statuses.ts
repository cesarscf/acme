import { type DeliveryStatus, type Message, nowInSeconds, type Store } from './store';
import { envelope, type Webhooks } from './webhooks';

export function reportStatus(store: Store, webhooks: Webhooks, message: Message, status: DeliveryStatus) {
  message.status = status;
  store.onChange();
  const outcome =
    status === 'failed'
      ? {
          errors: [
            {
              code: 131026,
              title: 'Message undeliverable',
              message: 'Message undeliverable',
              error_data: { details: 'Marked as failed in the Meta Emulator.' },
            },
          ],
        }
      : { pricing: { billable: true, pricing_model: 'PMP', type: 'regular', category: message.category ?? 'service' } };
  const body = envelope(message.phoneNumberId, {
    statuses: [
      {
        id: message.id,
        status,
        timestamp: String(nowInSeconds()),
        recipient_id: message.waId,
        ...(message.bizOpaqueCallbackData && { biz_opaque_callback_data: message.bizOpaqueCallbackData }),
        ...outcome,
      },
    ],
  });
  return webhooks.deliver(body);
}
