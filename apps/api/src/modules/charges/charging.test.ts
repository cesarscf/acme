import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { charges, db, workRecords } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { hasError, parsePix } from 'pix-utils';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { createCustomer } from '../customers/service';
import { listMessages } from '../whatsapp/service';
import { ensureChargeTemplates } from './service';

const api = treaty(app);
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
  await ensureChargeTemplates();
});

afterAll(async () => {
  await emulator.stop();
  await app.stop();
});

async function professionalWithBilling({ pixKey = true } = {}) {
  const signedIn = await signInNewProfessional();
  await api.team.post({ roles: ['billing'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const billingAssistant = team![0]!;
  const briefing = api.team({ id: billingAssistant.id }).briefing;
  await briefing.answers.post({ step: 'paymentMethods', option: 'pix_and_cash' }, { headers: signedIn.headers });
  if (pixKey) {
    await briefing.answers.post({ step: 'pixKey', text: 'carlos@example.com' }, { headers: signedIn.headers });
    await briefing.answers.post({ step: 'pixName', text: 'Carlos Souza' }, { headers: signedIn.headers });
    await briefing.answers.post({ step: 'pixCity', text: 'Campinas' }, { headers: signedIn.headers });
  }
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(signedIn.professional.id, { name: 'João Pereira', phoneNumber });
  return { ...signedIn, billingAssistant, joao };
}

async function workRecordFor(professionalId: string, customerId: string | null, amountCents: number | null = 35000) {
  const [workRecord] = await db
    .insert(workRecords)
    .values({
      professionalId,
      customerId,
      title: 'Limpeza de split',
      description: 'Limpeza de split + troca de capacitor',
      amountCents,
      paymentMethod: 'pix',
      transcript: 'Limpei o split do João e troquei o capacitor, 350 no Pix.',
    })
    .returning();
  return workRecord!;
}

type Professional = Awaited<ReturnType<typeof professionalWithBilling>>;

async function chargeSent(professional: Professional) {
  const workRecord = await workRecordFor(professional.professional.id, professional.joao.id);
  const thread = api['work-records']({ id: workRecord.id });
  const { data, status } = await thread.charge.post(undefined, { headers: professional.headers });
  expect(status).toBe(200);
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: professional.joao.phoneNumber });
  return { workRecord, thread, view: data!, sent: sent! };
}

function noticesOf({ billingAssistant, headers }: Professional) {
  return api
    .team({ id: billingAssistant.id })
    .messages.get({ headers })
    .then(({ data }) => data!.items.filter((item) => item.type === 'notice').map(({ text }) => text));
}

test('the service thread shows the "Para confirmar: cobrar no Pix" card as in the prototype, before anything is sent', async () => {
  const professional = await professionalWithBilling();
  const workRecord = await workRecordFor(professional.professional.id, professional.joao.id);

  const { data } = await api['work-records']({ id: workRecord.id }).get({ headers: professional.headers });

  expect(data).toMatchObject({ pixReady: true, charge: null });
  expect(data!.chargeCard).toEqual({
    title: 'Para confirmar: cobrar no Pix',
    subtitle: 'João Pereira',
    rows: [
      { label: 'Cliente', value: 'João Pereira' },
      { label: 'Serviço', value: 'Limpeza de split + troca de capacitor' },
      { label: 'Valor', value: expect.stringMatching(/^R\$\s350,00$/) },
      { label: 'Forma', value: 'Pix (link e QR Code)' },
      { label: 'Envio', value: 'WhatsApp do João' },
    ],
    notices: [
      'Nada é enviado ao João agora.',
      'Depois que você confirmar, ele recebe o link do Pix no WhatsApp e eu aviso quando o dinheiro cair.',
    ],
    question: expect.stringMatching(/^Confirma: cobrar R\$\s350 do João\?$/),
  });
  expect(await listMessages({ phoneNumberId: platformNumber, waId: professional.joao.phoneNumber })).toEqual([]);
});

test('Confirmar sends the Pix with the amount and the Charge id in the code, and the "Já paguei" button', async () => {
  const professional = await professionalWithBilling();

  const { workRecord, view, sent } = await chargeSent(professional);

  const [charge] = await db.select().from(charges).where(eq(charges.workRecordId, workRecord.id));
  expect(charge).toMatchObject({ status: 'pending', paymentMethod: 'pix', amountCents: 35000 });
  expect(charge!.sentAt).toBeInstanceOf(Date);
  expect(sent).toMatchObject({ type: 'template', originType: 'charge', originId: charge!.id });
  const template = (sent.payload as { template: { name: string; components: { parameters: object[] }[] } }).template;
  expect(template.name).toBe('pix_charge');
  const code = (template.components[0]!.parameters.at(-1) as { text: string }).text;
  const pix = parsePix(code);
  expect(hasError(pix)).toBe(false);
  expect(pix).toMatchObject({
    pixKey: 'carlos@example.com',
    transactionAmount: 350,
    txid: charge!.id.replaceAll('-', '').slice(0, 25),
  });
  expect(template.components[1]).toMatchObject({ type: 'button', parameters: [{ payload: 'paid' }] });
  expect(view.charge).toMatchObject({ id: charge!.id, status: 'pending', amountCents: 35000, pixCode: code });
});

test('"Já paguei" puts the Charge in awaiting_confirmation and the billing Assistant asks "Recebi / Não caiu"', async () => {
  const professional = await professionalWithBilling();
  const { thread, sent } = await chargeSent(professional);

  const click = await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  expect(click.data?.webhook?.status).toBe(200);
  const { data } = await thread.get({ headers: professional.headers });
  expect(data!.charge!.status).toBe('awaiting_confirmation');
  expect(await noticesOf(professional)).toEqual([
    expect.stringMatching(/^João Pereira tocou em Já paguei no Pix de R\$\s350,00\. .*Recebi ou Não caiu\?$/),
  ]);
});

test('"Recebi" marks the Charge paid and "Caiu!" reaches the billing conversation; the service shows as Pago', async () => {
  const professional = await professionalWithBilling();
  const { thread, sent, workRecord } = await chargeSent(professional);
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const { data } = await thread.charge.confirmation.post({ received: true }, { headers: professional.headers });

  expect(data!.charge).toMatchObject({ status: 'paid', paidAt: expect.any(Date) });
  expect(data!.paid).toBe(true);
  expect((await noticesOf(professional)).at(-1)).toMatch(/^Caiu! Os R\$\s350 do João já estão na sua conta\.$/);
  const { data: list } = await api['work-records'].get({ headers: professional.headers });
  expect(list!.find(({ id }) => id === workRecord.id)!.paid).toBe(true);
  const again = await thread.charge.confirmation.post({ received: false }, { headers: professional.headers });
  expect(again.status).toBe(409);
});

test('"Não caiu" puts the Charge back to pending, and a later "Já paguei" asks again', async () => {
  const professional = await professionalWithBilling();
  const { thread, sent } = await chargeSent(professional);
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const { data } = await thread.charge.confirmation.post({ received: false }, { headers: professional.headers });
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  expect(data!.charge!.status).toBe('pending');
  expect(data!.paid).toBe(false);
  expect((await thread.get({ headers: professional.headers })).data!.charge!.status).toBe('awaiting_confirmation');
  expect(await noticesOf(professional)).toHaveLength(2);
});

test('without the Pix key, or before the Customer and the amount are known, nothing is charged', async () => {
  const withoutKey = await professionalWithBilling({ pixKey: false });
  const workRecord = await workRecordFor(withoutKey.professional.id, withoutKey.joao.id);
  const thread = api['work-records']({ id: workRecord.id });
  expect((await thread.get({ headers: withoutKey.headers })).data!.pixReady).toBe(false);
  expect((await thread.charge.post(undefined, { headers: withoutKey.headers })).status).toBe(409);

  const professional = await professionalWithBilling();
  const incomplete = await workRecordFor(professional.professional.id, null, null);
  const incompleteThread = api['work-records']({ id: incomplete.id });
  expect((await incompleteThread.get({ headers: professional.headers })).data!.chargeCard).toBeNull();
  expect((await incompleteThread.charge.post(undefined, { headers: professional.headers })).status).toBe(409);

  expect(await db.select().from(charges).where(eq(charges.workRecordId, workRecord.id))).toEqual([]);
  expect(await db.select().from(charges).where(eq(charges.workRecordId, incomplete.id))).toEqual([]);
});

test('Confirmar twice sends the Pix once', async () => {
  const professional = await professionalWithBilling();
  const { thread } = await chargeSent(professional);

  const again = await thread.charge.post(undefined, { headers: professional.headers });

  expect(again.status).toBe(409);
  expect(await listMessages({ phoneNumberId: platformNumber, waId: professional.joao.phoneNumber })).toHaveLength(1);
});
