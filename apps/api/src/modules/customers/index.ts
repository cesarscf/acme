import { Elysia, status } from 'elysia';
import { auth } from '../auth';
import { CustomersModel } from './model';
import { listCustomerSections } from './sections';
import { getCustomerThread } from './thread';

export const customers = new Elysia()
  .use(auth)
  .model(CustomersModel)
  .get('/customers', ({ professional, query: { query } }) => listCustomerSections(professional.id, query), {
    auth: true,
    query: 'customers.Search',
  })
  .get(
    '/customers/:id/thread',
    async ({ professional, params: { id } }) => {
      const thread = await getCustomerThread(professional.id, id);
      if (!thread) throw status(404, 'Customer not found');
      return thread;
    },
    { auth: true, params: 'customers.Customer' },
  );
