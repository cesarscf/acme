import { expect, test } from 'bun:test';
import { createApp } from './app';

test('GET /health answers ok', async () => {
  const app = createApp({ appSecret: 'secret', verifyToken: 'verify', webhookUrl: 'http://127.0.0.1:1/webhook' });
  const response = await app.handle(new Request('http://localhost/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
