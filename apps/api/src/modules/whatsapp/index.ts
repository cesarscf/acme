import { Value } from '@sinclair/typebox/value';
import { Elysia, status, t } from 'elysia';
import { WhatsappModel } from './model';
import { isSignedByMeta, isVerifiedSubscription, receiveWebhook } from './service';

export const whatsapp = new Elysia()
  .model(WhatsappModel)
  .get(
    '/webhooks/whatsapp',
    ({ query }) => {
      if (!isVerifiedSubscription(query['hub.mode'], query['hub.verify_token'])) throw status(403, 'Forbidden');
      return query['hub.challenge'];
    },
    { query: 'whatsapp.Verification' },
  )
  .post(
    '/webhooks/whatsapp',
    async ({ body, headers }) => {
      if (!isSignedByMeta(body, headers['x-hub-signature-256'])) throw status(401, 'Invalid signature');
      const webhook = parseJson(body);
      if (!Value.Check(WhatsappModel['whatsapp.Webhook'], webhook)) throw status(400, 'Unexpected webhook payload');
      await receiveWebhook(webhook);
      return 'EVENT_RECEIVED';
    },
    // Meta signs the raw body, so it is kept as text until the signature is checked.
    { parse: 'text', body: t.String() },
  );

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
