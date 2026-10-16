import { Elysia, sse, status } from 'elysia';
import { auth } from '../auth';
import {
  claimCustomerThread,
  decide,
  findAssistant,
  hasAiConsent,
  isWorking,
  releaseCustomerThread,
  sendText,
  startTurn,
  type TurnEvent,
} from '../conversations/service';
import { CustomersModel } from './model';
import { listCustomerSections } from './sections';
import { chooseAssistant, findThreadConfirmation, inCustomerThread } from './team-messages';
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
        const assistant = inCustomerThread(chosen, thread);
        turn = withSpeaker(
          assistant,
          startTurn(assistant, (emit) => sendText(assistant, text, emit)),
        );
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
        const assistant = inCustomerThread(owner, thread);
        turn = withSpeaker(
          assistant,
          startTurn(assistant, (emit) => decide(assistant, confirmation, confirmed, emit)),
        );
      } finally {
        releaseCustomerThread(id);
      }
      for await (const event of turn) yield sse({ data: event });
    },
    { auth: true, params: 'customers.Confirmation', body: 'customers.Decision' },
  );

// The thread shows who answers before the first word arrives.
async function* withSpeaker(assistant: { id: string }, turn: AsyncGenerator<TurnEvent>): AsyncGenerator<TurnEvent> {
  yield { type: 'assistant', assistantId: assistant.id };
  yield* turn;
}
