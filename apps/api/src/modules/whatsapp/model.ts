import { t } from 'elysia';

const inboundMessage = t.Object({
  from: t.String(),
  id: t.String(),
  timestamp: t.String(),
  type: t.String(),
  context: t.Optional(t.Object({ id: t.String() })),
  text: t.Optional(t.Object({ body: t.String() })),
  button: t.Optional(t.Object({ payload: t.String(), text: t.String() })),
  interactive: t.Optional(
    t.Object({
      type: t.String(),
      button_reply: t.Optional(t.Object({ id: t.String(), title: t.String() })),
    }),
  ),
});

const statusUpdate = t.Object({
  id: t.String(),
  status: t.String(),
  timestamp: t.String(),
  recipient_id: t.String(),
  errors: t.Optional(t.Array(t.Unknown())),
});

export const WhatsappModel = {
  'whatsapp.Verification': t.Object({
    'hub.mode': t.String(),
    'hub.verify_token': t.String(),
    'hub.challenge': t.String(),
  }),
  'whatsapp.Webhook': t.Object({
    object: t.String(),
    entry: t.Array(
      t.Object({
        id: t.String(),
        changes: t.Array(
          t.Object({
            field: t.String(),
            value: t.Object({
              metadata: t.Optional(t.Object({ phone_number_id: t.String() })),
              messages: t.Optional(t.Array(inboundMessage)),
              statuses: t.Optional(t.Array(statusUpdate)),
            }),
          }),
        ),
      }),
    ),
  }),
};

export type Webhook = (typeof WhatsappModel)['whatsapp.Webhook']['static'];
export type InboundMessage = typeof inboundMessage.static;
export type StatusUpdate = typeof statusUpdate.static;
