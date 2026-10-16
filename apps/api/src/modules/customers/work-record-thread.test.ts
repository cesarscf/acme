import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { ensureChargeTemplates } from '../charges/service';
import { startFakeClaude } from '../conversations/fake-claude';
import { listMessages } from '../whatsapp/service';
import { createCustomer } from './service';

const api = treaty(app);
app.listen(0);
const claude = startFakeClaude();
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureChargeTemplates();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
  await app.stop();
});

async function professionalWithBilling() {
  const { professional, headers } = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers });
  await api.team.post({ roles: ['scheduling', 'billing'] }, { headers });
  const { data: team } = await api.team.get({ headers });
  const tina = team!.find(({ role }) => role === 'billing')!;
  const briefing = api.team({ id: tina.id }).briefing;
  await briefing.answers.post({ step: 'paymentMethods', option: 'pix_and_cash' }, { headers });
  await briefing.answers.post({ step: 'pixKey', text: 'carlos@example.com' }, { headers });
  await briefing.answers.post({ step: 'pixName', text: 'Carlos Souza' }, { headers });
  await briefing.answers.post({ step: 'pixCity', text: 'Campinas' }, { headers });
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(professional.id, { name: 'João Pereira', phoneNumber });
  return { professional, headers, joao, tina, thread: api.customers({ id: joao.id }) };
}

type Professional = Awaited<ReturnType<typeof professionalWithBilling>>;

function extraction(output: Record<string, unknown>) {
  const empty = {
    customer: null,
    newCustomer: null,
    visit: null,
    title: null,
    description: null,
    materials: null,
    amountCents: null,
    paymentMethod: null,
    cashReceived: null,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ...empty, ...output }) }] };
}

// The reference the extraction prompt gave to a Customer, e.g. "C1".
function refOf(request: Anthropic.Beta.MessageCreateParams, name: string) {
  return new RegExp(`- (C\\d+): ${name}`).exec(request.messages[0]!.content as string)![1]!;
}

async function recordService({ headers }: Professional, amountCents: number | null = 35000) {
  claude.reply((request) =>
    extraction({
      customer: refOf(request, 'João Pereira'),
      title: 'Limpeza de split',
      description: 'Limpeza de split e troca de capacitor',
      amountCents,
      paymentMethod: 'pix',
    }),
  );
  const { data } = await api['work-records'].post({ transcript: 'Limpei o split do João, 350 no Pix.' }, { headers });
  return data!;
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

function lastToolResult(request: Anthropic.Beta.MessageCreateParams) {
  const content = request.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
  return String(content.findLast((block) => block.type === 'tool_result')!.content);
}

function idIn(result: string) {
  return (JSON.parse(result.slice(result.indexOf('{'))) as { id: string }).id;
}

test('a service registered with an amount lands in the Customer thread, with the Tina offering "Cobrar no Pix"', async () => {
  const professional = await professionalWithBilling();
  const { thread, tina } = professional;

  const workRecord = await recordService(professional);

  expect(workRecord.customer).toMatchObject({ id: professional.joao.id });
  const { data } = await thread.thread.get({ headers: professional.headers });
  const card = data!.items.findIndex((item) => item.type === 'work_record');
  expect(data!.items[card]).toMatchObject({ label: 'Serviço registrado' });
  expect(data!.items[card + 1]).toMatchObject({
    type: 'assistant',
    text: 'Registrei o serviço do João. Escolha o que a equipe faz agora:',
    assistant: { id: tina.id },
  });
  expect(data!.actions).toEqual([
    { key: 'charge', label: 'Cobrar no Pix', role: 'billing', message: 'Cobrar no Pix', done: false },
  ]);
});

test('a visit registered without an amount asks how much the service was, and offers no charge', async () => {
  const professional = await professionalWithBilling();

  await recordService(professional, null);

  const { data } = await professional.thread.thread.get({ headers: professional.headers });
  const card = data!.items.findIndex((item) => item.type === 'work_record');
  expect(data!.items[card]).toMatchObject({ label: 'Visita registrada' });
  expect(data!.items[card + 1]).toMatchObject({
    type: 'assistant',
    text: 'Registrei a visita do João. Se já fez o serviço, quanto ficou? Me diga aqui embaixo.',
  });
  expect(data!.actions).toEqual([]);
});

async function chargeSent(professional: Professional) {
  const { thread, headers } = professional;
  const workRecord = await recordService(professional);
  claude.reply({ content: [call('createCharge', { workRecordId: workRecord.id })] }, (request) => ({
    content: [
      { type: 'text', text: 'Montei a cobrança. Confere antes de eu mandar:' },
      call('sendCharge', { chargeId: idIn(lastToolResult(request)) }),
    ],
  }));
  const events = await drain(thread.messages.post({ text: 'Cobrar no Pix', role: 'billing' }, { headers }));
  const { data } = await thread.thread.get({ headers });
  const card = data!.items.at(-1)!;
  claude.reply(say('Pronto, mandei o Pix para o João no WhatsApp. Te aviso quando cair.'));
  await drain(thread.confirmations({ confirmationId: card.id }).post({ confirmed: true }, { headers }));
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: professional.joao.phoneNumber });
  return { workRecord, events, card, sent: sent! };
}

test('"Cobrar no Pix" goes to the Tina without the router, and Confirmar sends the Pix shown with its QR Code', async () => {
  const professional = await professionalWithBilling();
  const { thread, headers, tina } = professional;

  const { events, card, sent } = await chargeSent(professional);

  // The first request is the Tina's turn itself: no router picked who answers.
  expect(events[0]).toEqual({ type: 'assistant', assistantId: tina.id });
  expect(card).toMatchObject({ type: 'confirmation', title: 'Para confirmar: cobrar no Pix' });
  expect(sent).toMatchObject({ originType: 'charge' });
  const { data } = await thread.thread.get({ headers });
  const pix = data!.items.find((item) => item.type === 'pix')!;
  expect(pix).toMatchObject({
    chargeId: sent.originId,
    status: { label: 'Aguardando pagamento' },
    pixCode: expect.stringContaining('br.gov.bcb.pix'),
  });
  expect(data!.actions).toEqual([expect.objectContaining({ key: 'charge', done: true })]);
  expect(data!.pinned!.status.label).toBe('Pix enviado');
});

test('a Role the team does not have cannot be addressed', async () => {
  const professional = await professionalWithBilling();

  const { status } = await professional.thread.messages.post(
    { text: 'Manda um orçamento', role: 'quotes' },
    { headers: professional.headers },
  );

  expect(status).toBe(404);
});

test('"Já paguei" makes the Tina ask in the thread whether the money arrived, and "Recebi" concludes the Job', async () => {
  const professional = await professionalWithBilling();
  const { thread, headers, tina } = professional;
  const { sent } = await chargeSent(professional);

  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const { data: asked } = await thread.thread.get({ headers });
  expect(asked!.items.at(-1)).toEqual({
    type: 'question',
    id: `paid_question:${sent.originId}`,
    at: expect.any(Date),
    text: 'João disse que já pagou. O dinheiro caiu?',
    assistant: expect.objectContaining({ id: tina.id }),
    role: 'billing',
    options: ['Recebi', 'Não caiu'],
  });
  claude.reply(
    { content: [call('confirmChargePaid', { chargeId: sent.originId, received: true })] },
    say('Caiu! Os R$ 350 do João já estão na sua conta.'),
  );

  await drain(thread.messages.post({ text: 'Recebi', role: 'billing' }, { headers }));

  const { data } = await thread.thread.get({ headers });
  expect(data!.pinned).toMatchObject({ label: 'CONCLUÍDO', status: { label: 'Pago' } });
  expect(data!.items.some((item) => item.type === 'question')).toBe(false);
  const lines = data!.items.flatMap((item) => (item.type === 'line' ? [item.text] : []));
  expect(lines).toEqual([expect.stringMatching(/^Pagamento recebido: R\$\s350,00$/), 'Atendimento concluído']);
  expect(data!.actions).toEqual([]);
});

test('"Não caiu" leaves the charge open and stops asking', async () => {
  const professional = await professionalWithBilling();
  const { thread, headers } = professional;
  const { sent } = await chargeSent(professional);
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });
  claude.reply(
    { content: [call('confirmChargePaid', { chargeId: sent.originId, received: false })] },
    say('Tudo bem, a cobrança continua em aberto.'),
  );

  await drain(thread.messages.post({ text: 'Não caiu', role: 'billing' }, { headers }));

  const { data } = await thread.thread.get({ headers });
  expect(data!.pinned).toMatchObject({ label: 'EM ANDAMENTO', status: { label: 'Pix enviado' } });
  expect(data!.items.some((item) => item.type === 'question' || item.type === 'line')).toBe(false);
  expect(data!.items.at(-1)).toMatchObject({ type: 'assistant', text: 'Tudo bem, a cobrança continua em aberto.' });
});

test('"Ficou 350 no Pix" in the thread completes the visit registered without an amount, through the Tina', async () => {
  const professional = await professionalWithBilling();
  const { thread, headers } = professional;
  const workRecord = await recordService(professional, null);
  claude.reply(
    say(JSON.stringify({ role: 'billing' })),
    (request) => {
      // The record's id is in the history the Tina reads.
      expect(JSON.stringify(request.system)).toContain(workRecord.id);
      return { content: [call('updateWorkRecord', { workRecordId: workRecord.id, correction: 'Ficou 350 no Pix' })] };
    },
    (request) => {
      expect(request.messages[0]!.content).toContain('Limpei o split do João, 350 no Pix.\nFicou 350 no Pix');
      return extraction({ amountCents: 35000, paymentMethod: 'pix' });
    },
    say('Anotei: R$ 350 no Pix.'),
  );

  await drain(thread.messages.post({ text: 'Ficou 350 no Pix' }, { headers }));

  const { data } = await thread.thread.get({ headers });
  const card = data!.items.find((item) => item.type === 'work_record')!;
  expect(card).toMatchObject({ label: 'Serviço registrado' });
  expect(data!.actions).toEqual([expect.objectContaining({ key: 'charge', done: false })]);
  expect(data!.items.at(-1)).toMatchObject({ type: 'assistant', text: 'Anotei: R$ 350 no Pix.' });
});
