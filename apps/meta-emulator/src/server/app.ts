import { Elysia, t } from 'elysia';
import { emulator } from './modules/emulator';
import { graph } from './modules/graph';
import { createStore } from './store';
import { createWebhooks } from './webhooks';

export type Config = { appSecret: string; verifyToken: string; webhookUrl: string };

export function createApp(config: Config) {
  const store = createStore();
  const webhooks = createWebhooks(config);
  const app = new Elysia()
    .get('/health', () => ({ status: 'ok' as const }), {
      response: t.Object({ status: t.Literal('ok') }),
    })
    .use(graph(store, webhooks))
    .use(emulator(store, webhooks));
  store.onChange = () => app.server?.publish('messages', JSON.stringify({ messages: store.messages }));
  return app;
}

export type App = ReturnType<typeof createApp>;
