import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { assistantMessages, db, jobs, runningTurns } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { and, eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { ensureQuoteTemplates, upsertPriceItem } from '../quotes/service';
import { createVisit } from '../visits/service';
import { listMessages } from '../whatsapp/service';
import { createCustomer } from './service';

const api = treaty(app);
const claude = startFakeClaude();
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: 'http://localhost:0/webhooks/whatsapp',
}).listen(0);
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureQuoteTemplates();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
});

async function professionalWith(roles: ('scheduling' | 'quotes' | 'billing')[]) {
  const { professional, headers } = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers });
  await api.team.post({ roles }, { headers });
  const { data: team } = await api.team.get({ headers });
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(professional.id, { name: 'João Pereira', phoneNumber });
  const assistantWith = (role: string) => team!.find((assistant) => assistant.role === role)!;
  return { professional, headers, joao, assistantWith, thread: api.customers({ id: joao.id }) };
}

async function drain<T>(request: Promise<{ data: AsyncIterable<{ data: T }> | null; error: unknown }>) {
  const { data, error } = await request;
  expect(error).toBeNull();
  const events: T[] = [];
  for await (const event of data!) events.push(event.data);
  return events;
}

function call(name: string, input: Record<string, unknown>) {
  return { type: 'tool_use' as const, id: `toolu_${randomUUID()}`, name, input };
}

function say(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function routeTo(role: string) {
  return say(JSON.stringify({ role }));
}

function lastToolResult(request: Anthropic.Beta.MessageCreateParams) {
  const content = request.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
  return String(content.findLast((block) => block.type === 'tool_result')!.content);
}

function idIn(result: string) {
  return (JSON.parse(result.slice(result.indexOf('{'))) as { id: string }).id;
}

function systemText(request: Anthropic.Beta.MessageCreateParams) {
  return (request.system as Anthropic.Beta.BetaTextBlockParam[]).map(({ text }) => text).join('\n');
}

test('what the Professional writes stays in the thread, tied to the open Job, and the Assistant answers there', async () => {
  const { professional, headers, joao, assistantWith, thread } = await professionalWith(['scheduling']);
  const visit = await createVisit(
    professional.id,
    joao.id,
    { scheduledAt: new Date(Date.now() + 2 * 86_400_000), durationMinutes: 60 },
    'Ar da sala não gela',
  );
  claude.reply(say('Anotado. O João tem visita marcada, quer que eu peça a confirmação?'));

  const events = await drain(thread.messages.post({ text: 'O João disse que vai estar em casa' }, { headers }));

  const schedulingAssistant = assistantWith('scheduling');
  expect(events[0]).toEqual({ type: 'assistant', assistantId: schedulingAssistant.id });
  expect(events.at(-1)).toEqual({ type: 'done' });
  const { data } = await thread.thread.get({ headers });
  expect(data!.working).toBe(false);
  expect(data!.items.slice(-2)).toEqual([
    expect.objectContaining({ type: 'professional', text: 'O João disse que vai estar em casa' }),
    expect.objectContaining({
      type: 'assistant',
      text: 'Anotado. O João tem visita marcada, quer que eu peça a confirmação?',
      assistant: {
        id: schedulingAssistant.id,
        name: schedulingAssistant.name,
        title: schedulingAssistant.title,
        mascot: schedulingAssistant.mascot,
      },
    }),
  ]);
  const [openJob] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.customerId, joao.id), eq(jobs.status, 'open')));
  const saved = await db.select().from(assistantMessages).where(eq(assistantMessages.customerId, joao.id));
  expect(saved.map(({ jobId }) => jobId)).toEqual([openJob!.id, openJob!.id]);
  // The Assistant knows whose thread it is and what happened with him.
  const system = systemText(claude.requests.at(-1)!);
  expect(system).toContain(joao.id);
  expect(system).toContain(visit.id);
  expect(system).toContain('Ar da sala não gela');
  // Nothing reaches the Customer, and the Assistant's own chat only links to what it said there.
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([]);
  const { data: chat } = await api.team({ id: schedulingAssistant.id }).messages.get({ headers });
  expect(chat!.items.map(({ type }) => type)).toEqual(['activity']);
  const { data: team } = await api.team.get({ headers });
  // The Lia's preview shows her last activity, never what the Professional wrote in the thread.
  expect(team!.find(({ id }) => id === schedulingAssistant.id)!.lastMessage).toMatchObject({
    from: 'assistant',
    text: 'Anotado. O João tem visita marcada, quer que eu peça a confirmação?',
  });
});

test('"Manda um orçamento" goes to the quotes Assistant, whose card shows in the thread and sends only when confirmed', async () => {
  const { professional, headers, joao, assistantWith, thread } = await professionalWith([
    'scheduling',
    'quotes',
    'billing',
  ]);
  await upsertPriceItem(professional.id, { name: 'Limpeza de split', priceCents: 15000 });
  claude.reply(
    routeTo('quotes'),
    {
      content: [
        call('createQuote', {
          customerId: joao.id,
          items: [
            { priceItemId: null, description: 'Compressor', quantity: 1, unitPriceCents: 120000 },
            { priceItemId: null, description: 'Mão de obra', quantity: 1, unitPriceCents: 25000 },
          ],
        }),
      ],
    },
    (request) => ({ content: [call('sendQuote', { quoteId: idIn(lastToolResult(request)) })] }),
  );

  const events = await drain(
    thread.messages.post(
      { text: 'Manda um orçamento de troca do compressor, 1.200 a peça e 250 a mão de obra' },
      { headers },
    ),
  );

  const quotesAssistant = assistantWith('quotes');
  expect(events[0]).toEqual({ type: 'assistant', assistantId: quotesAssistant.id });
  expect(events.at(-1)).toEqual({ type: 'awaiting_confirmation' });
  // The router saw the team and the message; the quotes Assistant got the thread's history.
  expect(JSON.stringify(claude.requests.at(-3)!.messages)).toContain('Manda um orçamento');
  expect(systemText(claude.requests.at(-1)!)).toContain(joao.id);
  const { data } = await thread.thread.get({ headers });
  const card = data!.items.at(-1)!;
  expect(card).toMatchObject({ type: 'confirmation', status: 'pending', title: expect.stringContaining('orçamento') });
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([]);

  claude.reply(say('Mandei. Te aviso quando ele responder.'));
  await drain(thread.confirmations({ confirmationId: card.id }).post({ confirmed: true }, { headers }));

  const sent = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });
  expect(sent).toHaveLength(1);
  const { data: after } = await thread.thread.get({ headers });
  expect(after!.items).toContainEqual(expect.objectContaining({ id: card.id, status: 'confirmed' }));
  expect(after!.items.at(-1)).toMatchObject({
    type: 'assistant',
    text: 'Mandei. Te aviso quando ele responder.',
    assistant: { id: quotesAssistant.id },
  });
  // The Olga's own chat only links to what she said there.
  const { data: chat } = await api.team({ id: quotesAssistant.id }).messages.get({ headers });
  expect(chat!.items.map(({ type }) => type)).toEqual(['activity']);
});

test('a card from a Customer thread is not decided from the Assistant chat or from another Customer', async () => {
  const { professional, headers, joao, assistantWith, thread } = await professionalWith(['quotes']);
  const { customer: maria } = await createCustomer(professional.id, {
    name: 'Maria Souza',
    phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
  });
  claude.reply(
    {
      content: [
        call('createQuote', {
          customerId: joao.id,
          items: [{ priceItemId: null, description: 'Limpeza', quantity: 1, unitPriceCents: 15000 }],
        }),
      ],
    },
    (request) => ({ content: [call('sendQuote', { quoteId: idIn(lastToolResult(request)) })] }),
  );
  await drain(thread.messages.post({ text: 'Manda um orçamento de limpeza, 150' }, { headers }));
  const { data } = await thread.thread.get({ headers });
  const card = data!.items.at(-1)!;

  const fromChat = await api
    .team({ id: assistantWith('quotes').id })
    .confirmations({ confirmationId: card.id })
    .post({ confirmed: true }, { headers });
  const fromMaria = await api
    .customers({ id: maria.id })
    .confirmations({ confirmationId: card.id })
    .post({ confirmed: true }, { headers });

  expect(fromChat.status).toBe(404);
  expect(fromMaria.status).toBe(404);
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([]);
});

test('writing in the thread needs the AI consent, and another Professional cannot write there', async () => {
  const { joao } = await professionalWith(['quotes']);
  const stranger = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers: stranger.headers });

  const { status } = await api
    .customers({ id: joao.id })
    .messages.post({ text: 'Manda um orçamento' }, { headers: stranger.headers });

  expect(status).toBe(404);
  const noConsent = await signInNewProfessional();
  await api.team.post({ roles: ['quotes'] }, { headers: noConsent.headers });
  const { customer } = await createCustomer(noConsent.professional.id, {
    name: 'Ana Lima',
    phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
  });
  const refused = await api
    .customers({ id: customer.id })
    .messages.post({ text: 'Manda um orçamento' }, { headers: noConsent.headers });
  expect(refused.status).toBe(403);
});

test('a second message while the team picks who answers waits for the first', async () => {
  const { headers, thread } = await professionalWith(['scheduling', 'quotes']);
  claude.reply(routeTo('quotes'), say('Qual o valor?'));

  const [first, second] = await Promise.all([
    thread.messages.post({ text: 'Manda um orçamento' }, { headers }),
    thread.messages.post({ text: 'Remarca para segunda' }, { headers }),
  ]);

  expect([first.status, second.status].sort()).toEqual([200, 409]);
  for await (const _ of (first.status === 200 ? first : second).data!) {
  }
  const { data } = await thread.thread.get({ headers });
  expect(data!.working).toBe(false);
});

test('a turn another API process is running holds the thread until it expires', async () => {
  const { headers, joao, thread } = await professionalWith(['quotes']);
  // Another process's turn is known only through the database.
  await db.insert(runningTurns).values({ customerId: joao.id, expiresAt: new Date(Date.now() + 60_000) });

  const held = await thread.messages.post({ text: 'Manda um orçamento' }, { headers });
  expect(held.status).toBe(409);
  expect((await thread.thread.get({ headers })).data!.working).toBe(true);

  await db
    .update(runningTurns)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(runningTurns.customerId, joao.id));
  expect((await thread.thread.get({ headers })).data!.working).toBe(false);
  claude.reply(say('Qual serviço entra no orçamento?'));
  const events = await drain(thread.messages.post({ text: 'Manda um orçamento' }, { headers }));
  expect(events.at(-1)).toEqual({ type: 'done' });
  expect((await thread.thread.get({ headers })).data!.working).toBe(false);
});

test('a Job the Assistant opens during the turn holds the rest of that turn', async () => {
  const { headers, joao, thread } = await professionalWith(['quotes']);
  claude.reply(
    {
      content: [
        call('createQuote', {
          customerId: joao.id,
          items: [{ priceItemId: null, description: 'Limpeza', quantity: 1, unitPriceCents: 15000 }],
        }),
      ],
    },
    say('Montei o orçamento, quer que eu mande?'),
  );

  await drain(thread.messages.post({ text: 'Monta um orçamento de limpeza, 150' }, { headers }));

  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.customerId, joao.id));
  const saved = await db
    .select({ jobId: assistantMessages.jobId })
    .from(assistantMessages)
    .where(eq(assistantMessages.customerId, joao.id))
    .orderBy(assistantMessages.createdAt);
  expect(saved.map(({ jobId }) => jobId)).toEqual([null, null, job!.id, job!.id]);
});

test('an Assistant asks a teammate in the thread, and the teammate answers right after, without the Professional relaying', async () => {
  const { headers, assistantWith, thread } = await professionalWith(['scheduling', 'quotes', 'billing']);
  claude.reply(
    routeTo('quotes'),
    {
      content: [
        call('askTeammate', { role: 'scheduling', message: 'Lia, veja um horário para a troca do compressor.' }),
      ],
    },
    say('Pedi para a Lia ver o horário.'),
    say('Tenho segunda às 10h ou terça às 14h. Qual prefere?'),
  );

  const events = await drain(
    thread.messages.post({ text: 'Orçamento aprovado, já vê um horário para a troca' }, { headers }),
  );

  const quotesAssistant = assistantWith('quotes');
  const schedulingAssistant = assistantWith('scheduling');
  expect(events.filter(({ type }) => type === 'assistant')).toEqual([
    { type: 'assistant', assistantId: quotesAssistant.id },
    { type: 'assistant', assistantId: schedulingAssistant.id },
  ]);
  // Lia gets the request as a teammate's, with the thread's history in her prompt.
  const asked = claude.requests.at(-1)!;
  expect(JSON.stringify(asked.messages.at(-1))).toContain('<colega nome=\\"Olga\\">Lia, veja um horário');
  expect(systemText(asked)).toContain('Orçamento aprovado, já vê um horário para a troca');
  const { data } = await thread.thread.get({ headers });
  expect(data!.items.slice(-4)).toEqual([
    expect.objectContaining({ type: 'professional', text: 'Orçamento aprovado, já vê um horário para a troca' }),
    expect.objectContaining({
      type: 'handoff',
      text: 'Lia, veja um horário para a troca do compressor.',
      assistant: expect.objectContaining({ id: quotesAssistant.id }),
      to: expect.objectContaining({ id: schedulingAssistant.id }),
    }),
    expect.objectContaining({ type: 'assistant', text: 'Pedi para a Lia ver o horário.' }),
    expect.objectContaining({
      type: 'assistant',
      text: 'Tenho segunda às 10h ou terça às 14h. Qual prefere?',
      assistant: expect.objectContaining({ id: schedulingAssistant.id }),
    }),
  ]);
});

test('an Assistant calling a teammate says whom it is calling, by the name the Professional gave', async () => {
  const { headers, assistantWith, thread } = await professionalWith(['scheduling', 'quotes']);
  const schedulingAssistant = assistantWith('scheduling');
  await api.team({ id: schedulingAssistant.id }).patch({ name: 'Carla' }, { headers });
  claude.reply(
    routeTo('quotes'),
    { content: [call('askTeammate', { role: 'scheduling', message: 'Carla, veja um horário para a troca.' })] },
    say('Pedi para a Carla ver o horário.'),
    say('Tenho segunda às 10h.'),
  );

  const events = await drain(thread.messages.post({ text: 'Aprovado, já vê um horário' }, { headers }));

  expect(events.filter(({ type }) => type === 'status')).toEqual([
    { type: 'status', text: 'Chamando a equipe' },
    { type: 'status', text: 'Chamando Carla' },
  ]);
});

test('Assistants asking each other stop after a few hops', async () => {
  const { headers, thread } = await professionalWith(['scheduling', 'quotes']);
  const askBack = (role: string) => ({ content: [call('askTeammate', { role, message: 'Veja isso.' })] });
  claude.reply(routeTo('quotes'));
  for (let hop = 0; hop < 5; hop++) claude.reply(askBack(hop % 2 ? 'quotes' : 'scheduling'), say('Ok.'));

  const events = await drain(thread.messages.post({ text: 'Vejam isso' }, { headers }));

  expect(events.filter(({ type }) => type === 'assistant')).toHaveLength(5);
  expect(events.at(-1)).toEqual({ type: 'done' });
});
