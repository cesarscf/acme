import { Elysia, sse, status } from 'elysia';
import { auth } from '../auth';
import { findAssistant, hasAiConsent } from '../conversations/service';
import {
  claimCustomerThread,
  decide,
  isWorking,
  releaseCustomerThread,
  sendText,
  startTurn,
  type TurnEvent,
} from '../conversations/turn';
import { CustomersModel } from './model';
import { listCustomerSections } from './sections';
import { chooseAssistant, findThreadConfirmation, inCustomerThread, runTeam } from './team-messages';
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
  )
  .post(
    '/customers/:id/messages',
    async function* ({ professional, params: { id }, body: { text } }) {
      const thread = await getCustomerThread(professional.id, id);
      if (!thread) throw status(404, 'Customer not found');
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      if (!claimCustomerThread(id)) throw status(409, 'The team is working');
      let turn: AsyncGenerator<TurnEvent>;
      try {
        const chosen = await chooseAssistant(professional.id, thread, text);
        if (!chosen) throw status(409, 'No Assistant on the team');
        if (isWorking(chosen.id)) throw status(409, 'Assistant is working');
        const assistant = await inCustomerThread(chosen, thread);
        turn = startTurn(assistant, (emit) => runTeam(assistant, (first, to) => sendText(first, text, to), emit));
      } finally {
        releaseCustomerThread(id);
      }
      for await (const event of turn) yield sse({ data: event });
    },
    { auth: true, params: 'customers.Customer', body: 'customers.Message' },
  )
  .post(
    '/customers/:id/confirmations/:confirmationId',
    async function* ({ professional, params: { id, confirmationId }, body: { confirmed } }) {
      const confirmation = await findThreadConfirmation(professional.id, id, confirmationId);
      if (!confirmation) throw status(404, 'No pending confirmation');
      if (isWorking(confirmation.assistantId) || !claimCustomerThread(id)) throw status(409, 'The team is working');
      let turn: AsyncGenerator<TurnEvent>;
      try {
        const thread = await getCustomerThread(professional.id, id);
        const owner = await findAssistant(professional.id, confirmation.assistantId);
        if (!thread || !owner) throw status(404, 'No pending confirmation');
        const assistant = await inCustomerThread(owner, thread);
        turn = startTurn(assistant, (emit) =>
          runTeam(assistant, (first, to) => decide(first, confirmation, confirmed, to), emit),
        );
      } finally {
        releaseCustomerThread(id);
      }
      for await (const event of turn) yield sse({ data: event });
    },
    { auth: true, params: 'customers.Confirmation', body: 'customers.Decision' },
  );
