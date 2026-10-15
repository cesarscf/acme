import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { db, llmUsages } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { listMessages } from '../whatsapp/service';
import { startFakeClaude } from './fake-claude';

const api = treaty(app);
const claude = startFakeClaude();
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: 'http://localhost:0/webhooks/whatsapp',
}).listen(0);

beforeAll(() => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
});

async function consentingProfessionalWithLia() {
  const signedIn = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
  await api.team.post({ roles: ['scheduling'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  return { ...signedIn, lia: team![0]! };
}

async function drain<T>(request: Promise<{ data: AsyncIterable<{ data: T }> | null; error: unknown }>) {
  const { data, error } = await request;
  expect(error).toBeNull();
  const events: T[] = [];
  for await (const event of data!) events.push(event.data);
  return events;
}

function newCustomerNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

function sendCustomerMessageCall(id: string, phoneNumber: string) {
  return {
    type: 'tool_use' as const,
    id,
    name: 'sendCustomerMessage',
    input: { customerName: 'João Pereira', phoneNumber, text: 'Oi João, chego às 14h.' },
  };
}

test('the Assistant needs the AI consent before the first task', async () => {
  const { headers } = await signInNewProfessional();
  await api.team.post({ roles: ['scheduling'] }, { headers });
  const { data: team } = await api.team.get({ headers });

  const { status } = await api.team({ id: team![0]!.id }).messages.post({ text: 'Oi' }, { headers });

  expect(status).toBe(403);
});

test('accepting the AI consent is recorded on the Professional', async () => {
  const { headers } = await signInNewProfessional();

  await api.me['ai-consent'].post(undefined, { headers });

  const { data } = await api.me.get({ headers });
  expect(data?.aiConsentedAt).toBeInstanceOf(Date);
});

test('the reply streams to the app and the conversation is kept', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  claude.reply({ content: [{ type: 'text', text: 'Oi! Sou a Lia.' }] });

  const events = await drain(api.team({ id: lia.id }).messages.post({ text: 'Oi, Lia' }, { headers }));

  expect(events).toContainEqual({ type: 'text', text: 'Oi! Sou a Lia.' });
  expect(events.at(-1)).toEqual({ type: 'done' });
  const { data } = await api.team({ id: lia.id }).messages.get({ headers });
  expect(data).toMatchObject({
    working: false,
    items: [
      { type: 'professional', text: 'Oi, Lia' },
      { type: 'assistant', text: 'Oi! Sou a Lia.' },
    ],
  });
});

test('Claude runs Haiku 5.5 by default, without the server-side fallback it does not have', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  claude.reply({ content: [{ type: 'text', text: 'Oi!' }] });

  await drain(api.team({ id: lia.id }).messages.post({ text: 'Oi' }, { headers }));

  const request = claude.requests.at(-1)!;
  expect(request).toMatchObject({ model: 'claude-haiku-5-5', stream: true, output_config: { effort: 'low' } });
  expect(request).not.toHaveProperty('fallbacks');
});

test('a model with server-side fallback gets it turned on', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  claude.reply({ content: [{ type: 'text', text: 'Oi!' }] });
  process.env.CLAUDE_MODEL = 'claude-opus-5-5';

  try {
    await drain(api.team({ id: lia.id }).messages.post({ text: 'Oi' }, { headers }));
  } finally {
    delete process.env.CLAUDE_MODEL;
  }

  expect(claude.requests.at(-1)).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default' });
  expect(claude.headers.at(-1)!.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
});

test('the prompt is cached, names the Assistant, and the tools are strict', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  await api.team({ id: lia.id }).patch({ name: 'Ana' }, { headers });
  claude.reply({ content: [{ type: 'text', text: 'Oi!' }] });

  await drain(api.team({ id: lia.id }).messages.post({ text: 'Oi' }, { headers }));

  const request = claude.requests.at(-1)!;
  const [fixed, assistant] = request.system as { text: string; cache_control?: object }[];
  expect(fixed!.cache_control).toEqual({ type: 'ephemeral' });
  expect(assistant!.text).toContain('Ana');
  expect(assistant!.text).toContain('Agenda');
  expect(request.tools).toContainEqual(expect.objectContaining({ name: 'sendCustomerMessage', strict: true }));
  expect(request.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Oi' }] }]);
});

test('token usage is recorded for the Professional and the Assistant', async () => {
  const { professional, headers, lia } = await consentingProfessionalWithLia();
  claude.reply({
    content: [{ type: 'text', text: 'Oi!' }],
    usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 900 },
  });

  await drain(api.team({ id: lia.id }).messages.post({ text: 'Oi' }, { headers }));

  const usages = await db.select().from(llmUsages).where(eq(llmUsages.professionalId, professional.id));
  expect(usages).toEqual([
    expect.objectContaining({
      assistantId: lia.id,
      model: 'claude-haiku-5-5',
      inputTokens: 1200,
      outputTokens: 80,
      cacheReadInputTokens: 900,
    }),
  ]);
});

test('a tool that sends something to the Customer shows a card and runs only after Confirmar', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  const customer = newCustomerNumber();
  const toolUseId = `toolu_${randomUUID()}`;
  claude.reply({
    content: [{ type: 'text', text: 'Vou avisar o João.' }, sendCustomerMessageCall(toolUseId, customer)],
  });

  const events = await drain(api.team({ id: lia.id }).messages.post({ text: 'Avisa o João' }, { headers }));

  expect(events.at(-1)).toEqual({ type: 'awaiting_confirmation' });
  expect(await listMessages({ phoneNumberId: process.env.META_PLATFORM_PHONE_NUMBER_ID!, waId: customer })).toEqual([]);
  const { data: paused } = await api.team({ id: lia.id }).messages.get({ headers });
  const card = paused!.items.at(-1)!;
  expect(card).toMatchObject({
    type: 'confirmation',
    status: 'pending',
    title: 'Para confirmar: mandar mensagem para João Pereira',
    question: 'Confirma: mandar a mensagem para João Pereira?',
  });
  claude.reply({ content: [{ type: 'text', text: 'Pronto, o João já recebeu.' }] });

  const resumed = await drain(
    api
      .team({ id: lia.id })
      .confirmations({ confirmationId: card.type === 'confirmation' ? card.id : '' })
      .post({ confirmed: true }, { headers }),
  );

  expect(resumed).toContainEqual({ type: 'text', text: 'Pronto, o João já recebeu.' });
  const sent = await listMessages({ phoneNumberId: process.env.META_PLATFORM_PHONE_NUMBER_ID!, waId: customer });
  expect(sent.map(({ text }) => text)).toEqual(['Oi João, chego às 14h.']);
  expect(claude.requests.at(-1)!.messages.at(-1)).toMatchObject({
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: toolUseId }],
  });
  const { data } = await api.team({ id: lia.id }).messages.get({ headers });
  expect(data!.items.find(({ type }) => type === 'confirmation')).toMatchObject({ status: 'confirmed' });
});

test('Cancelar tells Claude nothing was sent', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  const customer = newCustomerNumber();
  const toolUseId = `toolu_${randomUUID()}`;
  claude.reply({ content: [sendCustomerMessageCall(toolUseId, customer)] });
  await drain(api.team({ id: lia.id }).messages.post({ text: 'Avisa o João' }, { headers }));
  const { data: paused } = await api.team({ id: lia.id }).messages.get({ headers });
  const card = paused!.items.at(-1)!;
  claude.reply({ content: [{ type: 'text', text: 'Tudo bem, não mandei.' }] });

  await drain(
    api
      .team({ id: lia.id })
      .confirmations({ confirmationId: card.type === 'confirmation' ? card.id : '' })
      .post({ confirmed: false }, { headers }),
  );

  expect(await listMessages({ phoneNumberId: process.env.META_PLATFORM_PHONE_NUMBER_ID!, waId: customer })).toEqual([]);
  const [result] = claude.requests.at(-1)!.messages.at(-1)!.content as { type: string; content: string }[];
  expect(result).toMatchObject({ type: 'tool_result', tool_use_id: toolUseId });
  expect(result!.content).toContain('cancelou');
});

test('a new message instead of a decision cancels the pending card', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  const customer = newCustomerNumber();
  const toolUseId = `toolu_${randomUUID()}`;
  claude.reply({ content: [sendCustomerMessageCall(toolUseId, customer)] });
  await drain(api.team({ id: lia.id }).messages.post({ text: 'Avisa o João' }, { headers }));
  claude.reply({ content: [{ type: 'text', text: 'Certo, esqueci o João.' }] });

  await drain(api.team({ id: lia.id }).messages.post({ text: 'Deixa pra lá' }, { headers }));

  expect(await listMessages({ phoneNumberId: process.env.META_PLATFORM_PHONE_NUMBER_ID!, waId: customer })).toEqual([]);
  expect(claude.requests.at(-1)!.messages.at(-1)).toMatchObject({
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: toolUseId },
      { type: 'text', text: 'Deixa pra lá' },
    ],
  });
  const { data } = await api.team({ id: lia.id }).messages.get({ headers });
  expect(data!.items.find(({ type }) => type === 'confirmation')).toMatchObject({ status: 'cancelled' });
});

test('a refusal ends the turn without running tools and says so in the conversation', async () => {
  const { headers, lia } = await consentingProfessionalWithLia();
  const customer = newCustomerNumber();
  const toolUseId = `toolu_${randomUUID()}`;
  claude.reply({ content: [sendCustomerMessageCall(toolUseId, customer)], stop_reason: 'refusal' });

  const events = await drain(api.team({ id: lia.id }).messages.post({ text: 'Pedido estranho' }, { headers }));

  expect(events.at(-1)).toEqual({ type: 'done' });
  expect(await listMessages({ phoneNumberId: process.env.META_PLATFORM_PHONE_NUMBER_ID!, waId: customer })).toEqual([]);
  const { data } = await api.team({ id: lia.id }).messages.get({ headers });
  expect(data!.items).toEqual([
    { id: expect.any(String), type: 'professional', text: 'Pedido estranho' },
    { id: expect.any(String), type: 'assistant', text: 'Não posso ajudar com esse pedido.' },
  ]);
});

test("a Professional cannot talk to someone else's Assistant", async () => {
  const { lia } = await consentingProfessionalWithLia();
  const intruder = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers: intruder.headers });

  const read = await api.team({ id: lia.id }).messages.get({ headers: intruder.headers });
  const write = await api.team({ id: lia.id }).messages.post({ text: 'Oi' }, { headers: intruder.headers });

  expect(read.status).toBe(404);
  expect(write.status).toBe(404);
});
