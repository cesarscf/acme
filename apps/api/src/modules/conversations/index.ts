import { Elysia, sse, status } from 'elysia';
import { auth } from '../auth';
import { getConversation } from './history';
import { ConversationsModel } from './model';
import { findOpenSuggestion } from './notices';
import { isWorking } from './running-turns';
import { findAssistant, hasAiConsent } from './service';
import { answerSuggestion, decide, findPendingConfirmation, sendText, startTurn } from './turn';

export const conversations = new Elysia()
  .use(auth)
  .model(ConversationsModel)
  .get(
    '/team/:id/messages',
    async ({ professional, params: { id } }) => {
      const assistant = await findAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      return getConversation(assistant, await isWorking(assistant.id));
    },
    { auth: true, params: 'conversations.Assistant' },
  )
  .post(
    '/team/:id/messages',
    async function* ({ professional, params: { id }, body: { text } }) {
      const assistant = await findAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const turn = await startTurn(assistant, (emit) => sendText(assistant, text, emit));
      if (!turn) throw status(409, 'Assistant is working');
      for await (const event of turn) {
        yield sse({ data: event });
      }
    },
    { auth: true, params: 'conversations.Assistant', body: 'conversations.Message' },
  )
  .post(
    '/team/:id/confirmations/:confirmationId',
    async function* ({ professional, params: { id, confirmationId }, body: { confirmed } }) {
      const assistant = await findAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      const confirmation = await findPendingConfirmation(assistant.id, confirmationId, null);
      if (!confirmation) throw status(404, 'No pending confirmation');
      const turn = await startTurn(assistant, (emit) => decide(assistant, confirmation, confirmed, emit));
      if (!turn) throw status(409, 'Assistant is working');
      for await (const event of turn) {
        yield sse({ data: event });
      }
    },
    { auth: true, params: 'conversations.Confirmation', body: 'conversations.Decision' },
  )
  .post(
    '/team/:id/suggestions/:suggestionId',
    async function* ({ professional, params: { id, suggestionId }, body: { accepted } }) {
      const assistant = await findAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      const suggestion = await findOpenSuggestion(assistant.id, suggestionId);
      if (!suggestion) throw status(404, 'No open suggestion');
      if (accepted && !(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      const turn = await startTurn(assistant, (emit) => answerSuggestion(assistant, suggestion, accepted, emit));
      if (!turn) throw status(409, 'Assistant is working');
      for await (const event of turn) {
        yield sse({ data: event });
      }
    },
    { auth: true, params: 'conversations.Suggestion', body: 'conversations.SuggestionAnswer' },
  );
