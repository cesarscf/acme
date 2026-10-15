import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { type ButtonClick, listMessages, onButtonClick, sendMessage } from './service';

const phoneNumberId = '1001';

app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;

  await meta({ id: '0' }).message_templates.post({
    name: 'quote_sent',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Olá! Segue o orçamento de {{1}}.' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Aprovar' },
          { type: 'QUICK_REPLY', text: 'Recusar' },
        ],
      },
    ],
  });
});

afterAll(async () => {
  await emulator.stop();
  await app.stop();
});

function ok<T>({ data, error }: { data: T; error: unknown }) {
  expect(error).toBeNull();
  return data!;
}

function newCustomerNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

function sendQuote(to: string, quoteId: string) {
  return sendMessage({
    from: phoneNumberId,
    to,
    message: {
      type: 'template',
      template: {
        name: 'quote_sent',
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'R$ 350,00' }] }],
      },
    },
    origin: { type: 'quote', id: quoteId },
  });
}

test('clicking a template button routes the click to the Quote the template was sent for', async () => {
  const clicks: ButtonClick[] = [];
  onButtonClick('quote', (click) => {
    clicks.push(click);
  });
  const to = newCustomerNumber();
  const quoteId = randomUUID();
  await sendQuote(to, randomUUID());
  const { wamid } = await sendQuote(to, quoteId);

  ok(await meta.emulator.messages({ id: wamid }).click.post({ index: 1 }));

  expect(clicks).toHaveLength(1);
  expect(clicks[0]).toMatchObject({ originId: quoteId, button: { payload: 'Recusar', text: 'Recusar' } });
});

function textWebhook(from: string, wamid: string, body: string) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '0',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: phoneNumberId, phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: 'Cliente' }, wa_id: from }],
              messages: [{ from, id: wamid, timestamp: '1760000000', type: 'text', text: { body } }],
            },
          },
        ],
      },
    ],
  });
}

function sign(body: string, appSecret = process.env.META_APP_SECRET!) {
  return `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
}

function postWebhook(body: string, signature: string) {
  return app.handle(
    new Request('http://localhost/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body,
    }),
  );
}

test('a webhook with an invalid signature is rejected and nothing is stored', async () => {
  const from = newCustomerNumber();
  const body = textWebhook(from, `wamid.${randomUUID()}`, 'Oi, tudo bem?');

  const response = await postWebhook(body, sign(body, 'not-the-app-secret'));

  expect(response.status).toBe(401);
  expect(await listMessages({ phoneNumberId, waId: from })).toEqual([]);
});

test('a duplicate webhook is acknowledged but not processed twice', async () => {
  const clicks: ButtonClick[] = [];
  onButtonClick('quote', (click) => {
    clicks.push(click);
  });
  const to = newCustomerNumber();
  const { wamid } = await sendQuote(to, randomUUID());
  const click = ok(await meta.emulator.messages({ id: wamid }).click.post({ index: 0 }));

  const resent = ok(await meta.emulator.messages({ id: click.id }).resend.post());

  expect(resent.webhook?.status).toBe(200);
  expect(clicks).toHaveLength(1);
  const inbound = (await listMessages({ phoneNumberId, waId: to })).filter(({ direction }) => direction === 'inbound');
  expect(inbound.map(({ wamid }) => wamid)).toEqual([click.id]);
});

async function statusOf(to: string, wamid: string) {
  const messages = await listMessages({ phoneNumberId, waId: to });
  return messages.find((message) => message.wamid === wamid);
}

async function waitForStatus(to: string, wamid: string, status: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await statusOf(to, wamid))?.status === status) return;
    await Bun.sleep(20);
  }
  throw new Error(`${wamid} never reached ${status}`);
}

test('delivery statuses are stored per message and never move backwards', async () => {
  const to = newCustomerNumber();
  const first = await sendQuote(to, randomUUID());
  const second = await sendQuote(to, randomUUID());
  await waitForStatus(to, first.wamid, 'delivered');
  await waitForStatus(to, second.wamid, 'delivered');

  ok(await meta.emulator.messages({ id: first.wamid }).status.post({ status: 'read' }));
  ok(await meta.emulator.messages({ id: first.wamid }).status.post({ status: 'delivered' }));
  ok(await meta.emulator.messages({ id: second.wamid }).status.post({ status: 'failed' }));

  expect(await statusOf(to, first.wamid)).toMatchObject({ status: 'read', errors: null });
  expect(await statusOf(to, second.wamid)).toMatchObject({
    status: 'failed',
    errors: [expect.objectContaining({ code: 131026 })],
  });
});

test('free text from the Customer is kept in the history', async () => {
  const from = newCustomerNumber();
  const wamid = `wamid.${randomUUID()}`;
  const body = textWebhook(from, wamid, 'Oi, tudo bem?');

  const response = await postWebhook(body, sign(body));

  expect(response.status).toBe(200);
  expect(await listMessages({ phoneNumberId, waId: from })).toEqual([
    expect.objectContaining({ wamid, direction: 'inbound', type: 'text', text: 'Oi, tudo bem?' }),
  ]);
});

test('the verification handshake answers the challenge only for the right verify token', async () => {
  const verify = (token: string) =>
    app.handle(
      new Request(
        `http://localhost/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=1158201444`,
      ),
    );

  const accepted = await verify(process.env.META_VERIFY_TOKEN!);
  const refused = await verify('wrong-token');

  expect(accepted.status).toBe(200);
  expect(await accepted.text()).toBe('1158201444');
  expect(refused.status).toBe(403);
});

test('a click whose handler fails is answered with an error so the retry is processed', async () => {
  const clicks: ButtonClick[] = [];
  let failures = 1;
  onButtonClick('visit', (click) => {
    if (failures-- > 0) throw new Error('Visit unavailable');
    clicks.push(click);
  });
  const visitId = randomUUID();
  const { wamid } = await sendMessage({
    from: phoneNumberId,
    to: newCustomerNumber(),
    message: {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Confirma a visita amanhã às 9h?' },
        action: { buttons: [{ type: 'reply', reply: { id: 'confirm', title: 'Confirmar' } }] },
      },
    },
    origin: { type: 'visit', id: visitId },
  });

  const click = ok(await meta.emulator.messages({ id: wamid }).click.post({ index: 0 }));
  const resent = ok(await meta.emulator.messages({ id: click.id }).resend.post());

  expect(click.webhook?.status).toBe(500);
  expect(resent.webhook?.status).toBe(200);
  expect(clicks).toHaveLength(1);
  expect(clicks[0]).toMatchObject({ originId: visitId, button: { payload: 'confirm', text: 'Confirmar' } });
});

test('a signed webhook that is not JSON is refused as a bad request', async () => {
  const response = await postWebhook('not json', sign('not json'));

  expect(response.status).toBe(400);
});
