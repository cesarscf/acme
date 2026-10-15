import { afterAll, expect, test } from 'bun:test';
import { assistants, db, llmUsages } from '@acme/db';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { hasError, parsePix } from 'pix-utils';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';

const api = treaty(app);
const claude = startFakeClaude();

afterAll(() => claude.stop());

async function professionalWith(role: 'scheduling' | 'quotes' | 'billing', { consent = false } = {}) {
  const signedIn = await signInNewProfessional();
  if (consent) await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
  await api.team.post({ roles: [role] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const assistant = team![0]!;
  return { ...signedIn, assistant, briefing: api.team({ id: assistant.id }).briefing };
}

async function storedAssistant(id: string) {
  const [row] = await db.select().from(assistants).where(eq(assistants.id, id));
  return row!;
}

function interpretation(output: object) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
}

const schedulingChips = { agenda: 'paper', hours: 'weekdays', booking: 'ask_first', confirmations: 'day_before' };

async function answerWithChips(
  briefing: Awaited<ReturnType<typeof professionalWith>>['briefing'],
  headers: { cookie: string },
  chips: Record<string, string>,
) {
  for (const [step, option] of Object.entries(chips)) {
    const { status } = await briefing.answers.post({ step, option }, { headers });
    expect(status).toBe(200);
  }
}

test('the scheduling Briefing is the connect card and four questions, with Google Agenda coming soon', async () => {
  const { headers, assistant, briefing } = await professionalWith('scheduling');

  const { data, status } = await briefing.get({ headers });

  expect(assistant.hasBriefing).toBe(true);
  expect(status).toBe(200);
  expect(data).toMatchObject({
    status: 'draft',
    connect: {
      skipped: false,
      items: [
        { name: 'WhatsApp', availability: 'first_message' },
        { name: 'Google Agenda', availability: 'coming_soon' },
      ],
    },
    playbook: null,
  });
  expect(data!.steps.map(({ key, answer }) => [key, answer])).toEqual([
    ['agenda', null],
    ['hours', null],
    ['booking', null],
    ['confirmations', null],
  ]);
  expect(data!.steps[0]!.options[0]).toEqual({
    key: 'google_calendar',
    label: 'Google Agenda',
    hint: null,
    comingSoon: true,
  });
});

test('answering only with chips makes a valid Playbook without calling Claude', async () => {
  const { headers, assistant, briefing } = await professionalWith('scheduling');
  const requests = claude.requests.length;

  await briefing.connect.post(undefined, { headers });
  await answerWithChips(briefing, headers, schedulingChips);
  const { status } = await briefing.approve.post(undefined, { headers });

  expect(status).toBe(200);
  expect(claude.requests.length).toBe(requests);
  const stored = await storedAssistant(assistant.id);
  expect(stored.playbookStatus).toBe('approved');
  expect(stored.playbook).toEqual({
    agenda: 'paper',
    hours: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' }],
    booking: 'ask_first',
    confirmations: { when: 'day_before', time: '18:00' },
  });
});

test('the quotes chips make a valid Playbook too', async () => {
  const { headers, assistant, briefing } = await professionalWith('quotes');

  await answerWithChips(briefing, headers, {
    priceList: 'per_job',
    visitFee: 'free',
    quoteValidity: '15_days',
    followUp: 'remind',
  });
  const { status } = await briefing.approve.post(undefined, { headers });

  expect(status).toBe(200);
  expect((await storedAssistant(assistant.id)).playbook).toEqual({
    priceList: 'per_job',
    visitFee: { kind: 'free', amountCents: null },
    quoteValidity: 15,
    followUp: { action: 'remind', afterDays: 2 },
  });
});

test('each answer shows what the Professional said and the reason before the next question', async () => {
  const { headers, briefing } = await professionalWith('scheduling');

  await briefing.connect.post(undefined, { headers });
  await briefing.answers.post({ step: 'agenda', option: 'memory' }, { headers });

  const { data } = await briefing.get({ headers });
  expect(data!.connect.skipped).toBe(true);
  expect(data!.steps[0]!.answer).toEqual({
    said: 'Na cabeça',
    ack: 'Então eu viro a sua agenda. Você não precisa lembrar de mais nada.',
  });
  expect(data!.steps[1]!.answer).toBeNull();
});

test('a coming soon option cannot be chosen', async () => {
  const { headers, briefing } = await professionalWith('scheduling');

  const { status } = await briefing.answers.post({ step: 'agenda', option: 'google_calendar' }, { headers });

  expect(status).toBe(422);
});

test('a Playbook with steps left cannot be approved', async () => {
  const { headers, briefing } = await professionalWith('scheduling');
  await briefing.answers.post({ step: 'agenda', option: 'paper' }, { headers });

  const { status } = await briefing.approve.post(undefined, { headers });

  expect(status).toBe(409);
});

test('the draft Playbook comes when every step is answered, with the Routine marked', async () => {
  const { headers, briefing } = await professionalWith('scheduling');

  await answerWithChips(briefing, headers, schedulingChips);

  const { data } = await briefing.get({ headers });
  expect(data!.status).toBe('draft');
  expect(data!.playbook).toEqual([
    { step: null, label: 'O que faz', value: 'Marcar visitas e confirmar com os clientes', routine: null },
    { step: 'agenda', label: 'Onde', value: 'Aqui no app', routine: null },
    { step: 'hours', label: 'Atende', value: 'Seg a sex, 8h às 18h', routine: null },
    { step: 'booking', label: 'Sozinha', value: 'Pergunta antes de marcar', routine: null },
    { step: 'confirmations', label: 'Quando', value: 'Na véspera, às 18h', routine: 'Confirmações na véspera, às 18h' },
  ]);
});

test('a free text answer fills the field of that step', async () => {
  const { headers, assistant, briefing } = await professionalWith('scheduling', { consent: true });
  const hours = [
    { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '07:00', end: '17:00' },
    { days: ['sat'], start: '07:00', end: '11:00' },
  ];
  claude.reply(
    interpretation({ understood: true, value: hours, reply: 'Fechado: seg a sex das 7h às 17h, sábado até 11h.' }),
  );

  const { data, status } = await briefing.answers.post(
    { step: 'hours', text: 'de segunda a sexta das 7 às 17, sábado até as 11' },
    { headers },
  );

  expect(status).toBe(200);
  expect(data).toEqual({ understood: true });
  expect((await storedAssistant(assistant.id)).playbook).toEqual({ hours });
  const { data: state } = await briefing.get({ headers });
  expect(state!.steps[1]!.answer).toEqual({
    said: 'de segunda a sexta das 7 às 17, sábado até as 11',
    ack: 'Fechado: seg a sex das 7h às 17h, sábado até 11h.',
  });
  const request = claude.requests.at(-1)!;
  expect(request).toMatchObject({ model: 'claude-haiku-5-5', output_config: { format: { type: 'json_schema' } } });
  expect(JSON.stringify(request.messages)).toContain('Quais dias e horários você atende?');
});

test('free text Claude cannot fit into the field is not saved', async () => {
  const { headers, assistant, briefing } = await professionalWith('scheduling', { consent: true });
  claude.reply(
    interpretation({
      understood: false,
      value: null,
      reply: 'Não entendi os horários. Pode dizer os dias e as horas?',
    }),
  );

  const { data } = await briefing.answers.post({ step: 'hours', text: 'depende' }, { headers });

  expect(data).toEqual({ understood: false, reply: 'Não entendi os horários. Pode dizer os dias e as horas?' });
  expect((await storedAssistant(assistant.id)).playbook).toEqual({});
});

test('a value outside the field rules is refused even when Claude says it understood', async () => {
  const { headers, assistant, briefing } = await professionalWith('quotes', { consent: true });
  claude.reply(interpretation({ understood: true, value: 365, reply: 'Fechado: um ano.' }));

  const { data } = await briefing.answers.post({ step: 'quoteValidity', text: 'um ano' }, { headers });

  expect(data).toMatchObject({ understood: false });
  expect((await storedAssistant(assistant.id)).playbook).toEqual({});
});

test('free text needs the AI consent', async () => {
  const { headers, briefing } = await professionalWith('scheduling');

  const { status } = await briefing.answers.post({ step: 'hours', text: 'das 7 às 17' }, { headers });

  expect(status).toBe(403);
});

test('interpreting free text records the tokens for the Professional and the Assistant', async () => {
  const { professional, headers, assistant, briefing } = await professionalWith('quotes', { consent: true });
  claude.reply({
    ...interpretation({ understood: true, value: 10, reply: 'Fechado: 10 dias.' }),
    usage: { input_tokens: 321, output_tokens: 12 },
  });

  await briefing.answers.post({ step: 'quoteValidity', text: 'dez dias' }, { headers });

  const usages = await db.select().from(llmUsages).where(eq(llmUsages.professionalId, professional.id));
  expect(usages).toEqual([expect.objectContaining({ assistantId: assistant.id, inputTokens: 321, outputTokens: 12 })]);
});

test('Ajustar goes back to that step and keeps the other answers', async () => {
  const { headers, briefing } = await professionalWith('scheduling');
  await answerWithChips(briefing, headers, schedulingChips);

  const { status } = await briefing.adjust.post({ step: 'hours' }, { headers });

  expect(status).toBe(200);
  const { data } = await briefing.get({ headers });
  expect(data!.playbook).toBeNull();
  expect(data!.steps.map(({ answer }) => !!answer)).toEqual([true, false, true, true]);
  expect((await briefing.approve.post(undefined, { headers })).status).toBe(409);

  await briefing.answers.post({ step: 'hours', option: 'every_day' }, { headers });
  expect((await briefing.approve.post(undefined, { headers })).status).toBe(200);
});

test('the approved Playbook shows in Ver ficha and can be changed later without going back to draft', async () => {
  const { headers, briefing } = await professionalWith('scheduling');
  await answerWithChips(briefing, headers, schedulingChips);
  await briefing.approve.post(undefined, { headers });

  await briefing.answers.post({ step: 'confirmations', option: 'on_request' }, { headers });

  const { data } = await briefing.get({ headers });
  expect(data!.status).toBe('approved');
  expect(data!.playbook).toContainEqual({
    step: 'confirmations',
    label: 'Quando',
    value: 'Quando você pedir',
    routine: null,
  });
  expect((await briefing.adjust.post({ step: 'hours' }, { headers })).status).toBe(409);
});

test('the approved Playbook goes into the prompt as the Ver ficha rows', async () => {
  const { headers, assistant, briefing } = await professionalWith('scheduling', { consent: true });
  await answerWithChips(briefing, headers, schedulingChips);
  await briefing.approve.post(undefined, { headers });
  claude.reply({ content: [{ type: 'text', text: 'Oi!' }] });

  const { data } = await api.team({ id: assistant.id }).messages.post({ text: 'Oi' }, { headers });
  for await (const _ of data!) {
  }

  const [, context] = claude.requests.at(-1)!.system as { text: string }[];
  expect(context!.text).toContain('Atende: Seg a sex, 8h às 18h');
  expect(context!.text).toContain('Quando: Na véspera, às 18h');
});

test('the billing Briefing asks how the Professional receives and the Pix key, with bank and card coming soon', async () => {
  const { headers, assistant, briefing } = await professionalWith('billing');

  const { data, status } = await briefing.get({ headers });

  expect(assistant.hasBriefing).toBe(true);
  expect(status).toBe(200);
  expect(data!.connect.items).toEqual([
    { name: 'WhatsApp', reason: 'Mandar a cobrança ao cliente', availability: 'first_message' },
    { name: 'Banco', reason: 'Ver quando o dinheiro caiu', availability: 'coming_soon' },
  ]);
  expect(data!.steps.map(({ key }) => key)).toEqual(['paymentMethods', 'pixKey', 'pixName', 'pixCity']);
  expect(data!.steps[0]!.options.map(({ label, comingSoon }) => [label, comingSoon])).toEqual([
    ['Pix e dinheiro', false],
    ['Só Pix', false],
    ['Conectar banco', true],
    ['Cartão', true],
  ]);
  expect(data!.steps[1]).toMatchObject({ options: [], usesAi: false });
  expect(data!.steps[0]!.usesAi).toBe(true);
});

test('the billing Playbook keeps the PaymentMethods, the default and the Pix key, without calling Claude', async () => {
  const { headers, assistant, briefing } = await professionalWith('billing');
  const requests = claude.requests.length;

  await briefing.answers.post({ step: 'paymentMethods', option: 'pix_and_cash' }, { headers });
  const key = await briefing.answers.post({ step: 'pixKey', text: '(11) 98765-4321' }, { headers });
  await briefing.answers.post({ step: 'pixName', text: 'José  Antônio da Silva' }, { headers });
  await briefing.answers.post({ step: 'pixCity', text: 'São Paulo' }, { headers });

  expect(key.data).toEqual({ understood: true });
  expect(claude.requests.length).toBe(requests);
  expect((await storedAssistant(assistant.id)).playbook).toEqual({
    paymentMethods: { accepted: ['pix', 'cash'], default: 'pix' },
    pixKey: { type: 'phone', key: '+5511987654321' },
    pixName: 'José Antônio da Silva',
    pixCity: 'São Paulo',
  });
  const { data } = await briefing.get({ headers });
  expect(data!.steps[1]!.answer).toEqual({
    said: '(11) 98765-4321',
    ack: 'Anotei a chave: Celular (11) 98765-4321.',
  });
  expect(data!.playbook).toEqual([
    {
      step: null,
      label: 'O que faz',
      value: 'Gerar o Pix, confirmar o pagamento e lembrar quem atrasou',
      routine: null,
    },
    { step: 'paymentMethods', label: 'Recebe', value: 'Pix e dinheiro, o Pix por padrão', routine: null },
    { step: 'pixKey', label: 'Chave Pix', value: 'Celular (11) 98765-4321', routine: null },
    { step: 'pixName', label: 'Nome', value: 'José Antônio da Silva', routine: null },
    { step: 'pixCity', label: 'Cidade', value: 'São Paulo', routine: null },
  ]);
});

test('the draft Playbook comes with a R$ 0,01 test Pix to check the name in the bank app', async () => {
  const { headers, briefing } = await professionalWith('billing');
  expect((await briefing.get({ headers })).data!.testPix).toBeNull();

  await briefing.answers.post({ step: 'paymentMethods', option: 'pix' }, { headers });
  await briefing.answers.post({ step: 'pixKey', text: 'carlos@example.com' }, { headers });
  await briefing.answers.post({ step: 'pixName', text: 'Carlos Souza' }, { headers });
  await briefing.answers.post({ step: 'pixCity', text: 'Campinas' }, { headers });

  const { data } = await briefing.get({ headers });
  expect(data!.testPix!.text).toContain('R$ 0,01');
  const pix = parsePix(data!.testPix!.code);
  expect(hasError(pix)).toBe(false);
  expect(pix).toMatchObject({
    pixKey: 'carlos@example.com',
    merchantName: 'Carlos Souza',
    merchantCity: 'Campinas',
    transactionAmount: 0.01,
  });
});

test('a Pix key that is invalid for its type is refused with the reason', async () => {
  const { headers, assistant, briefing } = await professionalWith('billing');

  const { data } = await briefing.answers.post({ step: 'pixKey', text: '529.982.247-24' }, { headers });

  expect(data).toEqual({ understood: false, reply: 'Esse CPF não existe. Confira os números.' });
  expect((await storedAssistant(assistant.id)).playbook).toEqual({});
});

test('an unknown step is not found', async () => {
  const { headers, briefing } = await professionalWith('scheduling');

  const { status } = await briefing.answers.post({ step: 'priceList', option: 'typed' }, { headers });

  expect(status).toBe(404);
});

test("a Professional cannot touch someone else's Briefing", async () => {
  const owner = await professionalWith('scheduling');
  const intruder = await signInNewProfessional();

  const answered = await owner.briefing.answers.post(
    { step: 'agenda', option: 'paper' },
    { headers: intruder.headers },
  );
  const read = await owner.briefing.get({ headers: intruder.headers });

  expect(answered.status).toBe(404);
  expect(read.status).toBe(404);
});
