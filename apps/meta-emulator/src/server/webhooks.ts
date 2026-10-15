import { createHash, createHmac, randomInt } from 'node:crypto';
import type { Config } from './app';

// The emulator keeps no WABA registry, so every webhook comes from this one.
const wabaId = '0';

export type Webhooks = ReturnType<typeof createWebhooks>;

export function createWebhooks(config: Config) {
  let queue: Promise<unknown> = Promise.resolve();

  // Delivered one at a time so status webhooks reach the API in the order they happened.
  function deliver(body: string) {
    const delivery = queue.then(() => post(config, body));
    queue = delivery;
    return delivery;
  }

  async function verify() {
    const challenge = String(randomInt(1e9));
    const url = new URL(config.webhookUrl);
    url.search = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': config.verifyToken,
      'hub.challenge': challenge,
    }).toString();
    try {
      const response = await fetch(url);
      return { verified: response.status === 200 && (await response.text()) === challenge, status: response.status };
    } catch {
      return { verified: false, status: null };
    }
  }

  return { deliver, verify };
}

async function post({ appSecret, webhookUrl }: Config, body: string) {
  const signature = createHmac('sha256', appSecret).update(body).digest('hex');
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${signature}` },
      body,
    });
    return response.status;
  } catch {
    return null;
  }
}

export function envelope(phoneNumberId: string, value: Record<string, unknown>) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              // No phone number registry either, so the display number echoes the phone number id.
              metadata: { display_phone_number: phoneNumberId, phone_number_id: phoneNumberId },
              ...value,
            },
          },
        ],
      },
    ],
  });
}

export function contact(waId: string) {
  return { profile: { name: `Cliente ${waId.slice(-4)}` }, wa_id: waId, user_id: businessScopedUserId(waId) };
}

function businessScopedUserId(waId: string) {
  const digits = BigInt(`0x${createHash('sha256').update(waId).digest('hex').slice(0, 15)}`).toString();
  return `BR.${digits}`;
}
