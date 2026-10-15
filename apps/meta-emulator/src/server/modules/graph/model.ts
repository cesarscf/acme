import { t } from 'elysia';

const textParameter = t.Object({ type: t.Literal('text'), text: t.String() });

const templateComponent = t.Union([
  t.Object({ type: t.Union([t.Literal('header'), t.Literal('body')]), parameters: t.Array(textParameter) }),
  t.Object({
    type: t.Literal('button'),
    sub_type: t.Union([t.Literal('quick_reply'), t.Literal('url')]),
    index: t.String(),
    parameters: t.Array(t.Union([t.Object({ type: t.Literal('payload'), payload: t.String() }), textParameter])),
  }),
]);

const base = {
  messaging_product: t.Literal('whatsapp'),
  recipient_type: t.Optional(t.Literal('individual')),
  to: t.String(),
  biz_opaque_callback_data: t.Optional(t.String()),
};

export const GraphModel = {
  'graph.SendMessage': t.Union([
    t.Object({
      ...base,
      type: t.Literal('text'),
      text: t.Object({ body: t.String(), preview_url: t.Optional(t.Boolean()) }),
    }),
    t.Object({
      ...base,
      type: t.Literal('template'),
      template: t.Object({
        name: t.String(),
        language: t.Object({ code: t.String() }),
        components: t.Optional(t.Array(templateComponent)),
      }),
    }),
    t.Object({
      ...base,
      type: t.Literal('interactive'),
      interactive: t.Object({
        type: t.Literal('button'),
        header: t.Optional(t.Object({ type: t.Literal('text'), text: t.String() })),
        body: t.Object({ text: t.String() }),
        footer: t.Optional(t.Object({ text: t.String() })),
        action: t.Object({
          buttons: t.Array(
            t.Object({
              type: t.Literal('reply'),
              reply: t.Object({ id: t.String({ maxLength: 256 }), title: t.String({ maxLength: 20 }) }),
            }),
            { minItems: 1, maxItems: 3 },
          ),
        }),
      }),
    }),
  ]),
  'graph.CreateTemplate': t.Object({
    name: t.String(),
    language: t.String(),
    category: t.Union([t.Literal('UTILITY'), t.Literal('MARKETING'), t.Literal('AUTHENTICATION')]),
    components: t.Array(
      t.Object({
        type: t.Union([t.Literal('HEADER'), t.Literal('BODY'), t.Literal('FOOTER'), t.Literal('BUTTONS')]),
        format: t.Optional(t.String()),
        text: t.Optional(t.String()),
        example: t.Optional(
          t.Object({
            header_text: t.Optional(t.Array(t.String())),
            body_text: t.Optional(t.Array(t.Array(t.String()))),
          }),
        ),
        add_security_recommendation: t.Optional(t.Boolean()),
        code_expiration_minutes: t.Optional(t.Number()),
        buttons: t.Optional(
          t.Array(
            t.Object({
              type: t.Union([t.Literal('QUICK_REPLY'), t.Literal('URL'), t.Literal('OTP')]),
              text: t.Optional(t.String()),
              url: t.Optional(t.String()),
              example: t.Optional(t.Array(t.String())),
              otp_type: t.Optional(t.String()),
            }),
          ),
        ),
      }),
    ),
  }),
  'graph.ListTemplates': t.Object({ name: t.Optional(t.String()) }),
};

export type SendMessage = (typeof GraphModel)['graph.SendMessage']['static'];
export type CreateTemplate = (typeof GraphModel)['graph.CreateTemplate']['static'];
