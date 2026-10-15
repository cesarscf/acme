import { t } from 'elysia';

export const ConversationsModel = {
  'conversations.Assistant': t.Object({ id: t.String({ format: 'uuid' }) }),
  'conversations.Confirmation': t.Object({
    id: t.String({ format: 'uuid' }),
    confirmationId: t.String({ format: 'uuid' }),
  }),
  'conversations.Suggestion': t.Object({
    id: t.String({ format: 'uuid' }),
    suggestionId: t.String({ format: 'uuid' }),
  }),
  'conversations.Message': t.Object({ text: t.String({ minLength: 1, maxLength: 4000, pattern: '\\S' }) }),
  'conversations.Decision': t.Object({ confirmed: t.Boolean() }),
  'conversations.SuggestionAnswer': t.Object({ accepted: t.Boolean() }),
};
