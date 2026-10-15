import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { assistantNotices, db, workRecords } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { createCustomer } from '../customers/service';
import { createQuote, ensureQuoteTemplates, findQuote, sendQuote } from '../quotes/service';
import { cancelVisit, createVisit } from '../visits/service';
import { listMessages } from '../whatsapp/service';
import { startFakeClaude } from './fake-claude';

const api = treaty(app);
const claude = startFakeClaude();
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;
const hour = 3_600_000;

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureQuoteTemplates();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
  await app.stop();
});

async function professionalWithTeam() {
  const { professional, headers } = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers });
  await api.team.post({ roles: ['scheduling', 'quotes', 'billing'] }, { headers });
  const { data: team } = await api.team.get({ headers });
  const assistantWith = (role: string) => api.team({ id: team!.find((assistant) => assistant.role === role)!.id });
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(professional.id, { name: 'João Pereira', phoneNumber });
  return {
    // The default time zone every new Professional gets.
    professional: { id: professional.id, name: professional.name, timezone: 'America/Sao_Paulo' },
    headers,
    joao,
    scheduling: assistantWith('scheduling'),
    quotes: assistantWith('quotes'),
  };
}

type Team = Awaited<ReturnType<typeof professionalWithTeam>>;

async function drain<T>(request: Promise<{ data: AsyncIterable<{ data: T }> | null; error: unknown }>) {
  const { data, error } = await request;
  expect(error).toBeNull();
  const events: T[] = [];
  for await (const event of data!) events.push(event.data);
  return events;
}

function say(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

async function approveQuote({ professional, joao }: Team) {
  const quoteId = await createQuote(professional.id, joao.id, [
    { priceItemId: null, description: 'Instalação de split', quantity: 1, unitPriceCents: 45000 },
  ]);
  await sendQuote((await findQuote(professional.id, quoteId))!, professional, 15);
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });
  await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 0 });
}

async function sentTo(customer: Team['joao']) {
  const messages = await listMessages({ phoneNumberId: platformNumber, waId: customer.phoneNumber });
  return messages.filter(({ direction }) => direction === 'outbound').map(({ type }) => type);
}

async function itemsOf(conversation: Team['scheduling'], headers: Team['headers']) {
  const { data } = await conversation.messages.get({ headers });
  return data!.items;
}

test("an approved Quote shows in the scheduling Assistant's conversation with the suggestion to book the Visit", async () => {
  const team = await professionalWithTeam();
  const requests = claude.requests.length;

  await approveQuote(team);

  const items = await itemsOf(team.scheduling, team.headers);
  expect(items).toMatchObject([
    { type: 'notice', text: expect.stringMatching(/^João Pereira aprovou o orçamento de R\$\s450,00\.$/) },
    {
      type: 'suggestion',
      action: 'book_visit',
      question: 'Quer que eu marque a visita de João Pereira?',
      message: 'Marcar a visita de João Pereira',
      answer: null,
    },
  ]);
  expect((await itemsOf(team.quotes, team.headers)).at(-1)).toMatchObject({ type: 'notice' });
  expect(claude.requests.length).toBe(requests);
  expect(await sentTo(team.joao)).toEqual(['template']);
});

test('"Marcar a visita" asks the scheduling Assistant, which reads the approval, and sends nothing to the Customer', async () => {
  const team = await professionalWithTeam();
  await approveQuote(team);
  const suggestion = (await itemsOf(team.scheduling, team.headers)).find((item) => item.type === 'suggestion')!;
  claude.reply(say('Qual dia e horário fica bom para o João?'));

  const events = await drain(
    team.scheduling.suggestions({ suggestionId: suggestion.id }).post({ accepted: true }, { headers: team.headers }),
  );

  expect(events.at(-1)).toEqual({ type: 'done' });
  expect(claude.requests.at(-1)!.messages.at(-1)).toEqual({
    role: 'user',
    content: [
      { type: 'text', text: expect.stringMatching(/^<aviso>João Pereira aprovou o orçamento .+<\/aviso>$/) },
      { type: 'text', text: 'Marcar a visita de João Pereira' },
    ],
  });
  expect((await itemsOf(team.scheduling, team.headers)).slice(1)).toMatchObject([
    { type: 'suggestion', answer: 'accepted' },
    { type: 'professional', text: 'Marcar a visita de João Pereira' },
    { type: 'assistant', text: 'Qual dia e horário fica bom para o João?' },
  ]);
  expect(await sentTo(team.joao)).toEqual(['template']);
  const again = await team.scheduling
    .suggestions({ suggestionId: suggestion.id })
    .post({ accepted: true }, { headers: team.headers });
  expect(again.status).toBe(404);
});

test('"Agora não" puts the suggestion away without asking Claude', async () => {
  const team = await professionalWithTeam();
  await approveQuote(team);
  const suggestion = (await itemsOf(team.scheduling, team.headers)).find((item) => item.type === 'suggestion')!;
  const requests = claude.requests.length;

  await drain(
    team.scheduling.suggestions({ suggestionId: suggestion.id }).post({ accepted: false }, { headers: team.headers }),
  );

  expect(claude.requests.length).toBe(requests);
  expect((await itemsOf(team.scheduling, team.headers)).at(-1)).toMatchObject({
    type: 'suggestion',
    answer: 'dismissed',
  });
});

test('a declined Quote, or one already answered, suggests nothing to the scheduling Assistant', async () => {
  const team = await professionalWithTeam();
  const quoteId = await createQuote(team.professional.id, team.joao.id, [
    { priceItemId: null, description: 'Limpeza de split', quantity: 1, unitPriceCents: 18000 },
  ]);
  await sendQuote((await findQuote(team.professional.id, quoteId))!, team.professional, 15);
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: team.joao.phoneNumber });

  await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 1 });
  await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 0 });

  expect(await itemsOf(team.scheduling, team.headers)).toEqual([]);
});

test('a suggestion of another Assistant cannot be answered here', async () => {
  const team = await professionalWithTeam();
  await approveQuote(team);
  const suggestion = (await itemsOf(team.scheduling, team.headers)).find((item) => item.type === 'suggestion')!;

  const answer = await team.quotes
    .suggestions({ suggestionId: suggestion.id })
    .post({ accepted: true }, { headers: team.headers });
  const unknown = await team.scheduling
    .suggestions({ suggestionId: randomUUID() })
    .post({ accepted: true }, { headers: team.headers });

  expect(answer.status).toBe(404);
  expect(unknown.status).toBe(404);
  const [notice] = await db.select().from(assistantNotices).where(eq(assistantNotices.id, suggestion.id));
  expect(notice!.suggestionAnswer).toBeNull();
});

test('a Visit past its time offers "Registrar serviço" in the scheduling conversation, and not one ahead or cancelled', async () => {
  const team = await professionalWithTeam();
  const now = Date.now();
  const ended = await createVisit(team.professional.id, team.joao.id, {
    scheduledAt: new Date(now - 3 * hour),
    durationMinutes: 60,
  });
  await createVisit(team.professional.id, team.joao.id, {
    scheduledAt: new Date(now - 30 * 60_000),
    durationMinutes: 60,
  });
  await createVisit(team.professional.id, team.joao.id, { scheduledAt: new Date(now + 2 * hour), durationMinutes: 60 });
  const cancelled = await createVisit(team.professional.id, team.joao.id, {
    scheduledAt: new Date(now - 5 * hour),
    durationMinutes: 60,
  });
  await cancelVisit(cancelled.id);
  await createVisit(team.professional.id, team.joao.id, {
    scheduledAt: new Date(now - 9 * 24 * hour),
    durationMinutes: 60,
  });

  const items = await itemsOf(team.scheduling, team.headers);

  expect(items).toEqual([
    {
      id: ended.id,
      type: 'suggestion',
      action: 'record_work',
      question: expect.stringMatching(/^Terminou a visita de João Pereira, .+, \d\d\/\d\d, às \d\d:\d\d\?$/),
      workRecordId: null,
    },
  ]);
  expect(await itemsOf(team.quotes, team.headers)).toEqual([]);
});

test('"Registrar serviço" from an ended Visit saves the WorkRecord about that Visit and its Customer, then shows it done', async () => {
  const team = await professionalWithTeam();
  const visit = await createVisit(team.professional.id, team.joao.id, {
    scheduledAt: new Date(Date.now() - 3 * hour),
    durationMinutes: 60,
  });
  claude.reply({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          customer: null,
          newCustomer: { name: 'Carlos', phoneNumber: null },
          visit: null,
          title: 'Instalação de split',
          description: null,
          materials: null,
          amountCents: 45000,
          paymentMethod: 'pix',
          cashReceived: null,
        }),
      },
    ],
  });

  const { data: created } = await api['work-records'].post(
    { transcript: 'Instalei o split, ficou 450 no Pix.', visitId: visit.id },
    { headers: team.headers },
  );

  expect(created).toMatchObject({ customer: { id: team.joao.id }, amountCents: 45000 });
  expect(created!.chargeCard).not.toBeNull();
  const [saved] = await db.select().from(workRecords).where(eq(workRecords.id, created!.id));
  expect(saved).toMatchObject({ visitId: visit.id, customerId: team.joao.id });
  expect(await itemsOf(team.scheduling, team.headers)).toMatchObject([
    { id: visit.id, action: 'record_work', workRecordId: created!.id },
  ]);
});

test('"Registrar serviço" with a Visit of another Professional is refused', async () => {
  const team = await professionalWithTeam();
  const other = await professionalWithTeam();
  const visit = await createVisit(other.professional.id, other.joao.id, {
    scheduledAt: new Date(Date.now() - 3 * hour),
    durationMinutes: 60,
  });
  const requests = claude.requests.length;

  const { status } = await api['work-records'].post(
    { transcript: 'Instalei o split.', visitId: visit.id },
    { headers: team.headers },
  );

  expect(status).toBe(404);
  expect(claude.requests.length).toBe(requests);
});
