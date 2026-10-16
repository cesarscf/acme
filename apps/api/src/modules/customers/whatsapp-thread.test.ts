import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { db, workRecords } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { createCharge, ensureChargeTemplates, findCharge, sendCharge } from '../charges/service';
import { openJob } from '../jobs/service';
import { createQuote, ensureQuoteTemplates, findQuote, sendQuote } from '../quotes/service';
import { createVisit, ensureVisitConfirmationTemplate, findVisit, sendVisitConfirmation } from '../visits/service';
import { listMessages } from '../whatsapp/service';
import { createCustomer } from './service';

const api = treaty(app);
app.listen(0);
const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: `http://localhost:${app.server!.port}/webhooks/whatsapp`,
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;
const pixAccount = { key: 'carlos@example.com', name: 'Carlos Souza', city: 'Campinas' };

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureVisitConfirmationTemplate();
  await ensureQuoteTemplates();
  await ensureChargeTemplates();
});

afterAll(async () => {
  await emulator.stop();
  await app.stop();
});

function newPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

async function professionalWith(name: string, phoneNumber = newPhoneNumber()) {
  const signedIn = await signInNewProfessional();
  const professional = { ...signedIn.professional, timezone: 'America/Sao_Paulo' };
  const { customer } = await createCustomer(professional.id, { name, phoneNumber });
  return { professional, headers: signedIn.headers, customer };
}

type Professional = Awaited<ReturnType<typeof professionalWith>>;

async function lastSentTo(phoneNumber: string) {
  return (await listMessages({ phoneNumberId: platformNumber, waId: phoneNumber })).findLast(
    ({ direction }) => direction === 'outbound',
  )!;
}

async function tap(phoneNumber: string, index: number) {
  const sent = await lastSentTo(phoneNumber);
  const { data } = await meta.emulator.messages({ id: sent.wamid }).click.post({ index });
  expect(data?.webhook?.status).toBe(200);
}

async function write(phoneNumber: string, text: string) {
  const { data } = await meta.emulator
    .conversations({ phoneNumberId: platformNumber })({ waId: phoneNumber })
    .messages.post({
      text,
    });
  expect(data?.webhook?.status).toBe(200);
}

async function askToConfirm({ professional, customer }: Professional) {
  const created = await createVisit(
    professional.id,
    customer.id,
    { scheduledAt: new Date(Date.now() + 2 * 86_400_000), durationMinutes: 60 },
    'Ar da sala não gela',
  );
  await sendVisitConfirmation((await findVisit(professional.id, created.id))!, professional);
}

async function sendAQuote({ professional, customer }: Professional) {
  const id = await createQuote(professional.id, customer.id, [
    { priceItemId: null, description: 'Troca de compressor', quantity: 1, unitPriceCents: 180000 },
  ]);
  await sendQuote((await findQuote(professional.id, id))!, professional, 15);
}

async function sendAPix({ professional, customer }: Professional) {
  const [workRecord] = await db
    .insert(workRecords)
    .values({
      professionalId: professional.id,
      customerId: customer.id,
      jobId: await openJob(professional.id, customer.id, 'Serviço'),
      title: 'Troca de compressor',
      amountCents: 180000,
      paymentMethod: 'pix',
      transcript: 'Troquei o compressor, 1800 no Pix.',
    })
    .returning();
  const { charge } = await createCharge(professional.id, workRecord!.id);
  await sendCharge((await findCharge(professional.id, charge!.id))!, professional, pixAccount);
}

async function whatsappIn({ customer, headers }: Professional) {
  const { data } = await api.customers({ id: customer.id }).thread.get({ headers });
  return data!.items.flatMap((item) => (item.type === 'whatsapp' ? [item] : []));
}

test('what was sent to the Customer shows on the right with its buttons, and what they answered on the left', async () => {
  const joao = await professionalWith('João Pereira');
  const phoneNumber = joao.customer.phoneNumber;

  await askToConfirm(joao);
  await tap(phoneNumber, 0);
  await sendAQuote(joao);
  await tap(phoneNumber, 0);
  await sendAPix(joao);
  await tap(phoneNumber, 0);
  await write(phoneNumber, 'Paguei agora, confere aí');

  const sent = { direction: 'outbound', label: 'Enviado a João no WhatsApp' };
  const answered = { direction: 'inbound', label: 'João no WhatsApp', buttons: [] };
  expect(await whatsappIn(joao)).toMatchObject([
    { ...sent, text: expect.stringContaining('Podemos confirmar?'), buttons: ['Confirmar', 'Remarcar'] },
    { ...answered, text: 'Confirmar' },
    { ...sent, text: expect.stringContaining('Troca de compressor'), buttons: ['Aprovar', 'Recusar'] },
    { ...answered, text: 'Aprovar' },
    { ...sent, text: expect.stringContaining('Depois de pagar, toque em Já paguei.'), buttons: ['Já paguei'] },
    { ...answered, text: 'Já paguei' },
    { ...answered, text: 'Paguei agora, confere aí' },
  ]);
});

test('the sent message comes before the card of what it sent', async () => {
  const joao = await professionalWith('João Pereira');

  await sendAQuote(joao);

  const { data } = await api.customers({ id: joao.customer.id }).thread.get({ headers: joao.headers });
  const types = data!.items.map(({ type }) => type);
  expect(types.filter((type) => type === 'whatsapp' || type === 'quote')).toEqual(['whatsapp', 'quote']);
});

test("another Customer's messages and another Professional's never show, even on the same number", async () => {
  const phoneNumber = newPhoneNumber();
  const first = await professionalWith('João Pereira', phoneNumber);
  const second = await professionalWith('João P.', phoneNumber);
  const maria = await createCustomer(first.professional.id, { name: 'Maria Lima', phoneNumber: newPhoneNumber() });
  const firstMaria = { ...first, customer: maria.customer };

  await askToConfirm(first);
  await write(phoneNumber, 'Pode ser às 9h?');
  await askToConfirm(firstMaria);
  await sendAQuote(second);
  await write(phoneNumber, 'Recebi o orçamento');

  expect((await whatsappIn(first)).map(({ text }) => text)).toEqual([
    expect.stringContaining('Podemos confirmar?'),
    'Pode ser às 9h?',
  ]);
  expect((await whatsappIn(second)).map(({ text }) => text)).toEqual([
    expect.stringContaining('Troca de compressor'),
    'Recebi o orçamento',
  ]);
});
