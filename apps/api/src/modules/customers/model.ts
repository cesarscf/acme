import { t } from 'elysia';

export const CustomersModel = {
  'customers.Search': t.Object({ query: t.Optional(t.String({ maxLength: 100 })) }),
  'customers.Customer': t.Object({ id: t.String({ format: 'uuid' }) }),
  'customers.Confirmation': t.Object({
    id: t.String({ format: 'uuid' }),
    confirmationId: t.String({ format: 'uuid' }),
  }),
  'customers.Message': t.Object({ text: t.String({ minLength: 1, maxLength: 4000, pattern: '\\S' }) }),
  'customers.Decision': t.Object({ confirmed: t.Boolean() }),
};
