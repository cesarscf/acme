import { t } from 'elysia';

export const VisitsModel = {
  'visits.Confirmations': t.Object({ visitIds: t.Array(t.String({ format: 'uuid' }), { minItems: 1, maxItems: 100 }) }),
};
