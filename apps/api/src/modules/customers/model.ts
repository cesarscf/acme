import { t } from 'elysia';

export const CustomersModel = {
  'customers.Search': t.Object({ query: t.Optional(t.String({ maxLength: 100 })) }),
  'customers.Customer': t.Object({ id: t.String({ format: 'uuid' }) }),
};
