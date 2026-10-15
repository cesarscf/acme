import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { CustomersModel } from './model';
import { createCustomer, listCustomers, toPhoneNumber } from './service';

export const customers = new Elysia()
  .use(auth)
  .model(CustomersModel)
  .get('/customers', ({ professional }) => listCustomers(professional.id), { auth: true })
  .post(
    '/customers',
    async ({ professional, body: { name, phoneNumber } }) => {
      const digits = toPhoneNumber(phoneNumber);
      if (!digits) throw status(422, 'Phone number needs the area code');
      const { customer, created } = await createCustomer(professional.id, { name, phoneNumber: digits });
      if (!created) throw status(409, { customer });
      return customer;
    },
    { auth: true, body: 'customers.New' },
  );
