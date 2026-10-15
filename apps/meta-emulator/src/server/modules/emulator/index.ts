import { Elysia, status } from 'elysia';
import type { Store } from '../../store';
import type { Webhooks } from '../../webhooks';
import { EmulatorModel } from './model';
import { click, findOutbound, reply, report, resend } from './service';

export const emulator = (store: Store, webhooks: Webhooks) =>
  new Elysia({ prefix: '/emulator' })
    .model(EmulatorModel)
    .get('/messages', () => store.messages)
    .ws('/ws', {
      open(ws) {
        ws.subscribe('messages');
        ws.send({ messages: store.messages });
      },
    })
    .post(
      '/messages/:id/click',
      async ({ params: { id }, body: { index } }) => {
        const original = findOutbound(store, id);
        if (!original) throw status(404, 'Message not found');
        const sent = await click(store, webhooks, original, index);
        if (!sent) throw status(400, 'Button not found');
        return sent;
      },
      { body: 'emulator.Click' },
    )
    .post(
      '/messages/:id/status',
      ({ params: { id }, body }) => {
        const message = findOutbound(store, id);
        if (!message) throw status(404, 'Message not found');
        return report(store, webhooks, message, body.status);
      },
      { body: 'emulator.Status' },
    )
    .post('/messages/:id/resend', async ({ params: { id } }) => {
      const message = await resend(store, webhooks, id);
      if (!message) throw status(404, 'Message not found');
      return message;
    })
    .post('/webhook/verify', () => webhooks.verify())
    .post(
      '/conversations/:phoneNumberId/:waId/messages',
      ({ params, body: { text } }) => reply(store, webhooks, params, text),
      { body: 'emulator.Reply' },
    );
