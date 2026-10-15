import { Elysia, sse, status } from 'elysia';
import { auth } from '../auth';
import { ConversationsModel } from './model';
import {
  answerSuggestion,
  decide,
  findAssistant,
  findOpenSuggestion,
  findPendingConfirmation,
  getConversation,
  hasAiConsent,
  isWorking,
  sendText,
  startTurn,
} from './service';

export const conversations = new Elysia()
  .use(auth)
  .model(ConversationsModel)
  .get(
    '/team/:id/messages',
    async ({ professional, params: { id } }) => {
      const assistant = await findAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      return getConversation(assistant);
    },
    { auth: true, params: 'conversations.Assistant' },
  )
  .post(
    '/team/:id/messages',
    async function* ({ professional, params: { id }, body: { text } }) {
      const assistant = await findAssistant(professional.id, id);
      if (!assistant) throw status(404, 'Assistant not found');
      if (!(await hasAiConsent(professional.id))) throw status(403, 'AI consent required');
      if (isWorking(assistant.id)) throw status(409, 'Assistant is working');
      for await (const event of startTurn(assistant.id, (emit) => sendText(assistant, text, emit))) {
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
      const confirmation = await findPendingConfirmation(assistant.id, confirmationId);
      if (!confirmation) throw status(404, 'No pending confirmation');
      if (isWorking(assistant.id)) throw status(409, 'Assistant is working');
      for await (const event of startTurn(assistant.id, (emit) => decide(assistant, confirmation, confirmed, emit))) {
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
      if (isWorking(assistant.id)) throw status(409, 'Assistant is working');
      for await (const event of startTurn(assistant.id, (emit) =>
        answerSuggestion(assistant, suggestion, accepted, emit),
      )) {
        yield sse({ data: event });
      }
    },
    { auth: true, params: 'conversations.Suggestion', body: 'conversations.SuggestionAnswer' },
  );
