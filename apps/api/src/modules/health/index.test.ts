import { expect, test } from 'bun:test';
import { treaty } from '@elysia/eden';
import { app } from '../../app';

const api = treaty(app);

test('GET /health answers ok', async () => {
  const { data, status } = await api.health.get();
  expect(status).toBe(200);
  expect(data).toEqual({ status: 'ok' });
});
