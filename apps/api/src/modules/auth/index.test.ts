import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { ensureLoginCodeTemplate } from './service';

app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const api = treaty(app);

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureLoginCodeTemplate();
});

afterAll(async () => {
  await emulator.stop();
  await app.stop();
});

function newPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

function authRequest(path: string, body: unknown) {
  return app.handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function loginCodeSentTo(phoneNumber: string) {
  const { data: messages } = await meta.emulator.messages.get();
  const message = messages?.findLast(
    ({ phoneNumberId, waId }) => phoneNumberId === process.env.META_PLATFORM_PHONE_NUMBER_ID && waId === phoneNumber,
  );
  return message?.buttons.find(({ kind }) => kind === 'copy_code')?.payload;
}

test('the login code arrives on WhatsApp from the platform number and signs the Professional in', async () => {
  const phoneNumber = newPhoneNumber();

  const sent = await authRequest('/phone-number/send-otp', { phoneNumber });
  expect(sent.status).toBe(200);
  const code = await loginCodeSentTo(phoneNumber);
  expect(code).toMatch(/^\d{6}$/);

  const verified = await authRequest('/phone-number/verify', { phoneNumber, code });
  expect(verified.status).toBe(200);
  const cookie = verified.headers.getSetCookie().join('; ');

  const { data, status } = await api.me.get({ headers: { cookie } });
  expect(status).toBe(200);
  expect(data).toMatchObject({ phoneNumber });
});

test('a wrong code does not sign in', async () => {
  const phoneNumber = newPhoneNumber();
  await authRequest('/phone-number/send-otp', { phoneNumber });
  const code = await loginCodeSentTo(phoneNumber);
  const wrongCode = code === '000000' ? '111111' : '000000';

  const verified = await authRequest('/phone-number/verify', { phoneNumber, code: wrongCode });

  expect(verified.status).toBe(400);
  expect(verified.headers.getSetCookie()).toEqual([]);
});

test('a number outside Brazil gets no code', async () => {
  const sent = await authRequest('/phone-number/send-otp', { phoneNumber: '14155550123' });

  expect(sent.status).toBe(400);
  expect(await loginCodeSentTo('14155550123')).toBeUndefined();
});

test('protected routes answer 401 without a session', async () => {
  const { status } = await api.me.get();

  expect(status).toBe(401);
});

test('the login code template is created once however many times the API starts', async () => {
  await ensureLoginCodeTemplate();

  const { data } = await meta({ id: process.env.META_PLATFORM_WABA_ID! }).message_templates.get({
    query: { name: 'login_code' },
  });
  expect(data?.data).toEqual([expect.objectContaining({ name: 'login_code', status: 'APPROVED' })]);
});
