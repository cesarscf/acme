import { afterEach, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createApp } from '../../app';

type Json = Record<string, unknown>;
type Value = Json & { messages?: Json[]; statuses?: Json[] };
type Payload = Json & { entry: (Json & { changes: (Json & { value: Value })[] })[] };
type Received = { body: string; signature: string | null; json: Payload };

const value = (webhook: Received) => webhook.json.entry[0]!.changes[0]!.value;

const servers: { stop: () => void }[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop();
});

function startReceiver(verifyToken = 'verify-token') {
  const received: Received[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method === 'GET') {
        const query = new URL(request.url).searchParams;
        const valid = query.get('hub.mode') === 'subscribe' && query.get('hub.verify_token') === verifyToken;
        return valid ? new Response(query.get('hub.challenge')) : new Response('Forbidden', { status: 403 });
      }
      const body = await request.text();
      received.push({ body, signature: request.headers.get('X-Hub-Signature-256'), json: JSON.parse(body) });
      return new Response('EVENT_RECEIVED');
    },
  });
  servers.push(server);
  return { url: `http://localhost:${server.port}/webhook`, received };
}

function setup(receiverVerifyToken?: string) {
  const receiver = startReceiver(receiverVerifyToken);
  const app = createApp({ appSecret: 'app-secret', verifyToken: 'verify-token', webhookUrl: receiver.url });
  const call = (method: string, path: string, body?: unknown) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  return { app, call, received: receiver.received };
}

async function sendInteractive(call: ReturnType<typeof setup>['call']) {
  const response = await call('POST', '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: 'Confirma a visita amanhã às 9h?' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'confirm', title: 'Confirmar' } },
          { type: 'reply', reply: { id: 'reschedule', title: 'Remarcar' } },
        ],
      },
    },
  });
  return (await response.json()).messages![0].id as string;
}

const messageWebhooks = (received: Received[]) => received.filter((webhook) => value(webhook).messages);

test('clicking a reply button sends a signed interactive webhook pointing to the original message', async () => {
  const { call, received } = setup();
  const wamid = await sendInteractive(call);

  const click = await call('POST', `/emulator/messages/${wamid}/click`, { index: 1 });
  expect(click.status).toBe(200);

  const [webhook] = messageWebhooks(received);
  expect(webhook!.signature).toBe(`sha256=${createHmac('sha256', 'app-secret').update(webhook!.body).digest('hex')}`);
  expect(webhook!.json).toEqual({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: expect.any(String),
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: expect.any(String), phone_number_id: '1001' },
              contacts: [
                { profile: { name: expect.any(String) }, wa_id: '5511987654321', user_id: expect.any(String) },
              ],
              messages: [
                {
                  context: { from: expect.any(String), id: wamid },
                  from: '5511987654321',
                  id: expect.stringMatching(/^wamid\./),
                  timestamp: expect.stringMatching(/^\d+$/),
                  type: 'interactive',
                  interactive: { type: 'button_reply', button_reply: { id: 'reschedule', title: 'Remarcar' } },
                },
              ],
            },
          },
        ],
      },
    ],
  });
});

test('clicking a template quick reply sends a button webhook with the payload given on send', async () => {
  const { call, received } = setup();
  await call('POST', '/2001/message_templates', {
    name: 'visit_confirmation',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Confirma a visita de {{1}}?' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Confirmar' },
          { type: 'QUICK_REPLY', text: 'Remarcar' },
        ],
      },
    ],
  });
  const sent = await call('POST', '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'template',
    template: {
      name: 'visit_confirmation',
      language: { code: 'pt_BR' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: 'amanhã' }] },
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'confirm' }] },
      ],
    },
  });
  const wamid = (await sent.json()).messages![0].id;

  await call('POST', `/emulator/messages/${wamid}/click`, { index: 0 });
  await call('POST', `/emulator/messages/${wamid}/click`, { index: 1 });

  const [confirm, reschedule] = messageWebhooks(received).map((webhook) => value(webhook).messages![0]);
  expect(confirm).toMatchObject({
    context: { id: wamid },
    type: 'button',
    button: { payload: 'confirm', text: 'Confirmar' },
  });
  expect(reschedule).toMatchObject({
    context: { id: wamid },
    type: 'button',
    button: { payload: 'Remarcar', text: 'Remarcar' },
  });
});

test('a free text reply from the Customer sends a text webhook', async () => {
  const { call, received } = setup();

  const response = await call('POST', '/emulator/conversations/1001/5511987654321/messages', {
    text: 'Pode ser às 10h?',
  });
  expect(response.status).toBe(200);

  const [webhook] = messageWebhooks(received);
  expect(value(webhook!).messages).toEqual([
    {
      from: '5511987654321',
      id: expect.stringMatching(/^wamid\./),
      timestamp: expect.stringMatching(/^\d+$/),
      type: 'text',
      text: { body: 'Pode ser às 10h?' },
    },
  ]);
});

test('resending a webhook delivers the same body again, with the same wamid', async () => {
  const { call, received } = setup();
  const wamid = await sendInteractive(call);
  const reply = await (await call('POST', `/emulator/messages/${wamid}/click`, { index: 0 })).json();

  const resend = await call('POST', `/emulator/messages/${reply.id}/resend`);
  expect(resend.status).toBe(200);

  const [first, duplicate] = messageWebhooks(received);
  expect(duplicate!.body).toBe(first!.body);
  expect(duplicate!.signature).toBe(first!.signature);
  expect(value(duplicate!).messages![0]!.id).toBe(reply.id);
});

const statusWebhooks = (received: Received[]) => received.filter((webhook) => value(webhook).statuses);

async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) await Bun.sleep(10);
  expect(condition()).toBe(true);
}

test('a sent message reports sent and then delivered, echoing the callback data', async () => {
  const { call, received } = setup();
  const response = await call('POST', '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'text',
    text: { body: 'Olá!' },
    biz_opaque_callback_data: 'charge:42',
  });
  const wamid = (await response.json()).messages![0].id;

  await waitFor(() => statusWebhooks(received).length === 2);
  const [sent, delivered] = statusWebhooks(received);
  expect(sent!.signature).toBe(`sha256=${createHmac('sha256', 'app-secret').update(sent!.body).digest('hex')}`);
  expect(value(sent!)).toEqual({
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: expect.any(String), phone_number_id: '1001' },
    statuses: [
      {
        id: wamid,
        status: 'sent',
        timestamp: expect.stringMatching(/^\d+$/),
        recipient_id: '5511987654321',
        biz_opaque_callback_data: 'charge:42',
        pricing: { billable: true, pricing_model: 'PMP', type: 'regular', category: 'service' },
      },
    ],
  });
  expect(value(delivered!).statuses![0]).toMatchObject({ id: wamid, status: 'delivered' });

  const [message] = await (await call('GET', '/emulator/messages')).json();
  expect(message.status).toBe('delivered');
});

test('the screen can mark a message as read or failed', async () => {
  const { call, received } = setup();
  const wamid = await sendInteractive(call);
  await waitFor(() => statusWebhooks(received).length === 2);

  expect((await call('POST', `/emulator/messages/${wamid}/status`, { status: 'read' })).status).toBe(200);
  expect((await call('POST', `/emulator/messages/${wamid}/status`, { status: 'failed' })).status).toBe(200);

  const [read, failed] = statusWebhooks(received)
    .slice(2)
    .map((webhook) => value(webhook).statuses![0]);
  expect(read).toMatchObject({ id: wamid, status: 'read', pricing: { category: 'service' } });
  expect(failed).toMatchObject({
    id: wamid,
    status: 'failed',
    errors: [{ code: 131026, title: 'Message undeliverable' }],
  });
  expect(failed!.pricing).toBeUndefined();
});

test('verifying the webhook succeeds when the API echoes the challenge for our verify token', async () => {
  const { call } = setup();

  const response = await call('POST', '/emulator/webhook/verify');

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ verified: true, status: 200 });
});

test('verifying the webhook fails when the API expects another verify token', async () => {
  const { call } = setup('another-token');

  const response = await call('POST', '/emulator/webhook/verify');

  expect(await response.json()).toEqual({ verified: false, status: 403 });
});

test('a screen connected by WebSocket gets the messages when one arrives', async () => {
  const { app, call } = setup();
  app.listen(0);
  servers.push({ stop: () => app.stop() });
  const socket = new WebSocket(`ws://localhost:${app.server!.port}/emulator/ws`);
  const snapshots: { messages: { body: string }[] }[] = [];
  socket.addEventListener('message', (event) => snapshots.push(JSON.parse(event.data)));
  await waitFor(() => snapshots.length === 1);
  expect(snapshots[0]).toEqual({ messages: [] });

  await call('POST', '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'text',
    text: { body: 'Olá!' },
  });

  await waitFor(() => snapshots.length > 1);
  expect(snapshots.at(-1)!.messages).toMatchObject([{ body: 'Olá!' }]);
  socket.close();
});
