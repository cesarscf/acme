import { expect, test } from 'bun:test';
import { createApp } from '../../app';

const config = { appSecret: 'secret', verifyToken: 'verify', webhookUrl: 'http://127.0.0.1:1/webhook' };

function graph(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }),
  );
}

test('a text message answers with a wamid and shows up on the screen', async () => {
  const app = createApp(config);

  const response = await graph(app, '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'text',
    text: { body: 'Olá!' },
  });

  expect(response.status).toBe(200);
  const sent = await response.json();
  expect(sent).toEqual({
    messaging_product: 'whatsapp',
    contacts: [{ input: '5511987654321', wa_id: '5511987654321' }],
    messages: [{ id: expect.stringMatching(/^wamid\./) }],
  });

  const screen = await app.handle(new Request('http://localhost/emulator/messages'));
  const messages = await screen.json();
  expect(messages).toMatchObject([
    { id: sent.messages[0].id, direction: 'outbound', phoneNumberId: '1001', waId: '5511987654321', body: 'Olá!' },
  ]);
});

const quoteTemplate = {
  name: 'quote_sent',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Orçamento' },
    {
      type: 'BODY',
      text: 'Olá {{1}}, seu orçamento de {{2}} está pronto.',
      example: { body_text: [['Ana', 'R$ 350,00']] },
    },
    { type: 'FOOTER', text: 'Acme' },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Aprovar' },
        { type: 'QUICK_REPLY', text: 'Recusar' },
      ],
    },
  ],
};

test('a created template is approved and a send renders it with its quick replies', async () => {
  const app = createApp(config);

  const created = await graph(app, '/2001/message_templates', quoteTemplate);
  expect(created.status).toBe(200);
  expect(await created.json()).toEqual({ id: expect.any(String), status: 'APPROVED', category: 'UTILITY' });

  const response = await graph(app, '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'template',
    template: {
      name: 'quote_sent',
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Ana' },
            { type: 'text', text: 'R$ 350,00' },
          ],
        },
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'approve' }] },
      ],
    },
  });
  expect(response.status).toBe(200);
  const sent = await response.json();
  expect(sent.messages).toEqual([{ id: expect.stringMatching(/^wamid\./), message_status: 'accepted' }]);

  const messages = await (await app.handle(new Request('http://localhost/emulator/messages'))).json();
  expect(messages).toMatchObject([
    {
      id: sent.messages[0].id,
      header: 'Orçamento',
      body: 'Olá Ana, seu orçamento de R$ 350,00 está pronto.',
      footer: 'Acme',
      buttons: [
        { kind: 'quick_reply', text: 'Aprovar', payload: 'approve' },
        { kind: 'quick_reply', text: 'Recusar' },
      ],
    },
  ]);
});

test('sending a template that was never created fails like the Graph API', async () => {
  const app = createApp(config);

  const response = await graph(app, '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'template',
    template: { name: 'missing', language: { code: 'pt_BR' } },
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: 132001, type: 'OAuthException' } });
});

test('a request without an access token is refused like the Graph API', async () => {
  const app = createApp(config);

  const response = await app.handle(
    new Request('http://localhost/1001/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: '5511987654321', type: 'text', text: { body: 'Oi' } }),
    }),
  );

  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: 190, type: 'OAuthException' } });
});

test.each([
  ['BODY', { type: 'BODY', text: 'Olá {{1}}, seu orçamento de {{2}} está pronto.' }],
  ['BODY', { type: 'BODY', text: 'Olá {{1}}, seu orçamento de {{2}} está pronto.', example: { body_text: [['Ana']] } }],
  ['HEADER', { type: 'HEADER', format: 'TEXT', text: 'Orçamento {{1}}' }],
  ['BUTTONS', { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Pagar', url: 'https://acme.test/pay/{{1}}' }] }],
])('a template whose %s has variables without examples is refused like the Graph API', async (type, component) => {
  const app = createApp(config);

  const response = await graph(app, '/2001/message_templates', {
    name: 'missing_example',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [component],
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: {
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 2388043,
      error_user_msg: expect.stringContaining(type),
    },
  });
  const listed = await app.handle(
    new Request('http://localhost/2001/message_templates', { headers: { Authorization: 'Bearer token' } }),
  );
  expect((await listed.json()).data).toEqual([]);
});

test('a template with an example for every variable is approved', async () => {
  const app = createApp(config);

  const response = await graph(app, '/2001/message_templates', {
    name: 'with_examples',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Orçamento {{1}}', example: { header_text: ['#123'] } },
      { type: 'BODY', text: 'Olá {{1}}, total {{2}}.', example: { body_text: [['Ana', 'R$ 350,00']] } },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Pagar', url: 'https://acme.test/pay/{{1}}', example: ['abc123'] }],
      },
    ],
  });

  expect(response.status).toBe(200);
});

test('an invalid message is refused with an invalid parameter error', async () => {
  const app = createApp(config);

  const response = await graph(app, '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '5511987654321',
    type: 'text',
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: 100, type: 'OAuthException' } });
});

test('a login code sent with an authentication template shows the code and a copy button', async () => {
  const app = createApp(config);
  await graph(app, '/2001/message_templates', {
    name: 'login_code',
    language: 'pt_BR',
    category: 'AUTHENTICATION',
    components: [
      { type: 'BODY', add_security_recommendation: true },
      { type: 'FOOTER', code_expiration_minutes: 10 },
      { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copiar código' }] },
    ],
  });

  const response = await graph(app, '/9001/messages', {
    messaging_product: 'whatsapp',
    to: '5511912345678',
    type: 'template',
    template: {
      name: 'login_code',
      language: { code: 'pt_BR' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: '482913' }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] },
      ],
    },
  });
  expect(response.status).toBe(200);

  const messages = await (await app.handle(new Request('http://localhost/emulator/messages'))).json();
  expect(messages).toMatchObject([
    {
      phoneNumberId: '9001',
      waId: '5511912345678',
      body: '*482913* é seu código de verificação. Para sua segurança, não o compartilhe.',
      footer: 'Este código expira em 10 minutos.',
      buttons: [{ kind: 'copy_code', text: 'Copiar código', payload: '482913' }],
    },
  ]);
});

test('the recipient comes back as a digits-only wa_id', async () => {
  const app = createApp(config);

  const response = await graph(app, '/1001/messages', {
    messaging_product: 'whatsapp',
    to: '+55 11 98765-4321',
    type: 'text',
    text: { body: 'Olá!' },
  });

  expect((await response.json()).contacts).toEqual([{ input: '+55 11 98765-4321', wa_id: '5511987654321' }]);
});

test('templates are listed per WABA and can be filtered by name like the Graph API', async () => {
  const app = createApp(config);
  await graph(app, '/2001/message_templates', quoteTemplate);
  await graph(app, '/2001/message_templates', { ...quoteTemplate, name: 'visit_confirmation' });
  await graph(app, '/3001/message_templates', quoteTemplate);

  const response = await app.handle(
    new Request('http://localhost/2001/message_templates?name=quote_sent', {
      headers: { Authorization: 'Bearer token' },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [
      {
        id: expect.any(String),
        name: 'quote_sent',
        language: 'pt_BR',
        category: 'UTILITY',
        status: 'APPROVED',
        components: quoteTemplate.components,
      },
    ],
  });
});

test('the name filter also returns templates whose name only contains it, so callers must match the name exactly', async () => {
  const app = createApp(config);
  await graph(app, '/2001/message_templates', quoteTemplate);
  await graph(app, '/2001/message_templates', { ...quoteTemplate, name: 'quote_sent_reminder' });

  const response = await app.handle(
    new Request('http://localhost/2001/message_templates?name=quote_sent', {
      headers: { Authorization: 'Bearer token' },
    }),
  );

  const { data } = await response.json();
  expect(data.map(({ name }: { name: string }) => name)).toEqual(['quote_sent', 'quote_sent_reminder']);
});
