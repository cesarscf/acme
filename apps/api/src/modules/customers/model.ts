import { t } from 'elysia';

export const CustomersModel = {
  'customers.New': t.Object({
    name: t.String({ minLength: 1, maxLength: 80, pattern: '\\S' }),
    phoneNumber: t.String({ minLength: 1, maxLength: 30 }),
  }),
};
