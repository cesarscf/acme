import { expect, test } from 'bun:test';
import { app } from './app';

test('GET /health answers ok', async () => {
  const response = await app.handle(new Request('http://localhost/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
