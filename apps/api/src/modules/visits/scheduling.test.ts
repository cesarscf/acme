import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { customers, db, visits } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { findAssistant } from '../conversations/service';
import { runTool } from '../conversations/test-tools';
import { customerTools } from '../customers/tools';
import { listMessages } from '../whatsapp/service';
import { ensureVisitConfirmationTemplate } from './service';
import { localDate } from './time';
import { visitTools } from './tools';

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

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureVisitConfirmationTemplate();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
  await app.stop();
});

const tomorrow = () => localDate(new Date(Date.now() + 86_400_000), 'America/Sao_Paulo');

function newPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

async function professionalWithSchedulingAssistant() {
  const signedIn = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
  await api.team.post({ roles: ['scheduling'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const schedulingAssistant = (await findAssistant(signedIn.professional.id, team![0]!.id))!;
  return { headers: signedIn.headers, schedulingAssistant, conversation: api.team({ id: schedulingAssistant.id }) };
}

type SchedulingAssistant = Awaited<ReturnType<typeof professionalWithSchedulingAssistant>>['schedulingAssistant'];

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

function lastToolResult(request: Anthropic.Beta.MessageCreateParams) {
  const content = request.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
  return String(content.findLast((block) => block.type === 'tool_result')!.content);
}

async function bookJoao(schedulingAssistant: SchedulingAssistant, time = '14:00') {
  const created = await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name: 'João Pereira',
    phoneNumber: newPhoneNumber(),
  });
  const joao = JSON.parse(created.text.slice(created.text.indexOf('{'))) as { id: string; phoneNumber: string };
  await runTool(visitTools(schedulingAssistant), 'createVisit', {
    customerId: joao.id,
    date: tomorrow(),
    time,
    durationMinutes: null,
    allowConflict: false,
    title: null,
  });
  const [visit] = await db.select().from(visits).where(eq(visits.customerId, joao.id));
  return { joao, visit: visit! };
}

test('"Marca o João amanhã às 14h" creates the Customer and the Visit', async () => {
  const { headers, schedulingAssistant, conversation } = await professionalWithSchedulingAssistant();
  claude.reply({ content: [call('findCustomer', { query: 'João' })] }, say('Não achei o João. Qual o WhatsApp dele?'));
  await drain(conversation.messages.post({ text: 'Marca o João amanhã às 14h' }, { headers }));
  claude.reply(
    { content: [call('createCustomer', { name: 'João', phoneNumber: '(11) 98765-4321' })] },
    (request) => {
      const { id } = JSON.parse(lastToolResult(request).replace(/^[^{]*/, ''));
      return {
        content: [
          call('createVisit', {
            customerId: id,
            date: tomorrow(),
            time: '14:00',
            durationMinutes: null,
            allowConflict: false,
            title: null,
          }),
        ],
      };
    },
    say('Marquei o João amanhã às 14h.'),
  );

  await drain(conversation.messages.post({ text: '11 98765-4321' }, { headers }));

  const [joao] = await db
    .select()
    .from(customers)
    .where(eq(customers.professionalId, schedulingAssistant.professional.id));
  expect(joao).toMatchObject({ name: 'João', phoneNumber: '5511987654321' });
  const booked = await db.select().from(visits).where(eq(visits.customerId, joao!.id));
  expect(booked).toEqual([expect.objectContaining({ status: 'scheduled', durationMinutes: 60 })]);
  expect(localDate(booked[0]!.scheduledAt, 'America/Sao_Paulo')).toBe(tomorrow());
});

test('a Visit at the time of another one gets a conflict warning, and is booked only when the Professional insists', async () => {
  const { headers, schedulingAssistant, conversation } = await professionalWithSchedulingAssistant();
  await bookJoao(schedulingAssistant, '14:00');
  const created = await runTool(customerTools(schedulingAssistant), 'createCustomer', {
    name: 'Marta',
    phoneNumber: newPhoneNumber(),
  });
  const marta = JSON.parse(created.text.slice(created.text.indexOf('{'))) as { id: string };
  const book = (allowConflict: boolean) =>
    call('createVisit', {
      customerId: marta.id,
      date: tomorrow(),
      time: '14:00',
      durationMinutes: null,
      allowConflict,
      title: null,
    });
  let warning = '';
  claude.reply({ content: [book(false)] }, (request) => {
    warning = lastToolResult(request);
    return say('Às 14h você já tem o João Pereira. Marco a Marta mesmo assim?');
  });

  await drain(conversation.messages.post({ text: 'Marca a Marta amanhã às 14h' }, { headers }));

  expect(warning).toContain('conflito');
  expect(warning).toContain('João Pereira');
  expect(await db.select().from(visits).where(eq(visits.customerId, marta.id))).toEqual([]);
  claude.reply({ content: [book(true)] }, say('Pronto, marquei.'));

  await drain(conversation.messages.post({ text: 'Pode marcar' }, { headers }));

  expect(await db.select().from(visits).where(eq(visits.customerId, marta.id))).toHaveLength(1);
});

async function sendConfirmation(
  conversation: ReturnType<typeof api.team>,
  headers: { cookie: string },
  visitId: string,
) {
  claude.reply({ content: [call('sendVisitConfirmation', { visitId })] });
  const events = await drain(conversation.messages.post({ text: 'Pede pro João confirmar' }, { headers }));
  expect(events.at(-1)).toEqual({ type: 'awaiting_confirmation' });
  const { data } = await conversation.messages.get({ headers });
  const card = data!.items.at(-1)!;
  claude.reply(say('Mandei. Te aviso quando ele responder.'));
  await drain(conversation.confirmations({ confirmationId: card.id }).post({ confirmed: true }, { headers }));
  return card;
}

test("Confirmar on the Customer side marks the Visit confirmed and tells the Professional in the scheduling Assistant's conversation", async () => {
  const { headers, schedulingAssistant, conversation } = await professionalWithSchedulingAssistant();
  const { joao, visit } = await bookJoao(schedulingAssistant);

  const card = await sendConfirmation(conversation, headers, visit.id);

  expect(card).toMatchObject({
    type: 'confirmation',
    title: 'Para confirmar: pedir a confirmação de João Pereira',
    rows: expect.arrayContaining([{ label: 'Visita', value: expect.stringContaining('às 14:00') }]),
  });
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });
  expect(sent).toMatchObject({ type: 'template', originType: 'visit', originId: visit.id });

  const click = await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 0 });

  expect(click.data?.webhook?.status).toBe(200);
  const [confirmed] = await db.select().from(visits).where(eq(visits.id, visit.id));
  expect(confirmed!.status).toBe('confirmed');
  const { data } = await conversation.messages.get({ headers });
  expect(data!.items.at(-1)).toMatchObject({
    type: 'notice',
    text: expect.stringMatching(/^João Pereira confirmou a visita de .+, às 14:00\.$/),
  });
  claude.reply(say('Boa!'));

  await drain(conversation.messages.post({ text: 'Valeu' }, { headers }));

  expect(claude.requests.at(-1)!.messages.at(-1)).toEqual({
    role: 'user',
    content: [
      { type: 'text', text: expect.stringMatching(/^<aviso>João Pereira confirmou .+<\/aviso>$/) },
      { type: 'text', text: 'Valeu' },
    ],
  });
});

test('Remarcar on the Customer side tells the Professional the Customer wants another time', async () => {
  const { headers, schedulingAssistant, conversation } = await professionalWithSchedulingAssistant();
  const { joao, visit } = await bookJoao(schedulingAssistant);
  await sendConfirmation(conversation, headers, visit.id);
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });

  await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 1 });

  const [row] = await db.select().from(visits).where(eq(visits.id, visit.id));
  expect(row!.status).toBe('reschedule_requested');
  const { data } = await conversation.messages.get({ headers });
  expect(data!.items.at(-1)).toMatchObject({
    type: 'notice',
    text: expect.stringContaining('João Pereira pediu para remarcar a visita'),
  });
});

test('a click on the confirmation of a cancelled Visit leaves it cancelled and says so', async () => {
  const { headers, schedulingAssistant, conversation } = await professionalWithSchedulingAssistant();
  const { joao, visit } = await bookJoao(schedulingAssistant);
  await sendConfirmation(conversation, headers, visit.id);
  await runTool(visitTools(schedulingAssistant), 'cancelVisit', { visitId: visit.id });
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });

  await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 0 });

  const [row] = await db.select().from(visits).where(eq(visits.id, visit.id));
  expect(row!.status).toBe('cancelled');
  const { data } = await conversation.messages.get({ headers });
  expect(data!.items.at(-1)).toMatchObject({ type: 'notice', text: expect.stringContaining('está cancelada') });
});

test('sendVisitConfirmation sends the template with Confirmar and Remarcar, tied to the Visit', async () => {
  const { schedulingAssistant } = await professionalWithSchedulingAssistant();
  const { joao, visit } = await bookJoao(schedulingAssistant);

  const { text, isError } = await runTool(visitTools(schedulingAssistant), 'sendVisitConfirmation', {
    visitId: visit.id,
  });

  expect(isError).toBe(false);
  expect(text).toContain('João Pereira');
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });
  expect(sent).toMatchObject({ type: 'template', originType: 'visit', originId: visit.id });
  const { data: shown } = await meta.emulator.messages.get();
  expect(shown!.find(({ id }) => id === sent!.wamid)?.buttons.map((button) => button.text)).toEqual([
    'Confirmar',
    'Remarcar',
  ]);
});

test('Confirmar on a confirmation sent before the Visit was moved does not confirm the new time', async () => {
  const { headers, schedulingAssistant, conversation } = await professionalWithSchedulingAssistant();
  const { joao, visit } = await bookJoao(schedulingAssistant);
  await runTool(visitTools(schedulingAssistant), 'sendVisitConfirmation', { visitId: visit.id });
  await runTool(visitTools(schedulingAssistant), 'rescheduleVisit', {
    visitId: visit.id,
    date: tomorrow(),
    time: '16:00',
    allowConflict: false,
  });
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });

  await meta.emulator.messages({ id: sent!.wamid }).click.post({ index: 0 });

  const [row] = await db.select().from(visits).where(eq(visits.id, visit.id));
  expect(row!.status).toBe('scheduled');
  const { data } = await conversation.messages.get({ headers });
  expect(data!.items.at(-1)).toMatchObject({
    type: 'notice',
    text: expect.stringMatching(/às 14:00.*mudou para .*às 16:00/),
  });
});
