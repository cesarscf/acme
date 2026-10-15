import { t } from 'elysia';

export const HealthModel = {
  'health.Status': t.Object({ status: t.Literal('ok') }),
};
