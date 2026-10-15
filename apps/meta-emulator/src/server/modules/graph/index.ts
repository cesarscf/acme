import { Elysia, status } from 'elysia';
import type { Store } from '../../store';
import type { Webhooks } from '../../webhooks';
import { GraphModel } from './model';
import {
  componentMissingExample,
  createTemplate,
  graphError,
  listTemplates,
  missingExampleError,
  sendMessage,
} from './service';

export const graph = (store: Store, webhooks: Webhooks) =>
  new Elysia()
    .model(GraphModel)
    .onError(({ code, error }) => {
      if (code === 'VALIDATION')
        return status(400, graphError(100, `Invalid parameter: ${error.all[0]?.summary ?? error.type}`));
    })
    .onBeforeHandle(({ headers: { authorization } }) => {
      if (!authorization?.startsWith('Bearer ')) return status(401, graphError(190, 'Invalid OAuth 2.0 Access Token'));
    })
    .post(
      '/:id/messages',
      ({ params: { id }, body }) => {
        const sent = sendMessage(store, webhooks, id, body);
        if (!sent) throw status(400, graphError(132001, 'Template name does not exist in the translation'));
        return sent;
      },
      { body: 'graph.SendMessage' },
    )
    .post(
      '/:id/message_templates',
      ({ params: { id }, body }) => {
        const missing = componentMissingExample(body);
        if (missing) throw status(400, missingExampleError(missing));
        return createTemplate(store, id, body);
      },
      { body: 'graph.CreateTemplate' },
    )
    .get('/:id/message_templates', ({ params: { id }, query: { name } }) => listTemplates(store, id, name), {
      query: 'graph.ListTemplates',
    });
