import { Elysia, t } from 'elysia';

export const health = new Elysia().get('/health', () => ({ status: 'ok' as const }), {
  response: t.Object({ status: t.Literal('ok') }),
});
