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
import {
  chargeCard,
  confirmChargePaid,
  createCharge,
  ensureChargeTemplates,
  findCharge,
  findPixAccount,
  sendCharge,
} from './service';

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

// What Confirmar on the Tina's card does: the Charge is made and sent from the platform's number.
async function chargeSent(professional: Professional) {
  const { id } = professional.professional;
  const workRecord = await workRecordFor(id, professional.joao.id);
  const created = await createCharge(id, workRecord.id);
  if ('refused' in created) throw new Error(created.refused);
  await sendCharge(created.charge, { id, name: 'Carlos', timezone: 'America/Sao_Paulo' }, (await findPixAccount(id))!);
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: professional.joao.phoneNumber });
  return { workRecord, charge: (await findCharge(id, created.charge.id))!, sent: sent! };
}

function noticesOf({ billingAssistant, headers }: Professional) {
  return api
    .team({ id: billingAssistant.id })
    .messages.get({ headers })
    .then(({ data }) => data!.items.filter((item) => item.type === 'notice').map(({ text }) => text));
}

test('the "Para confirmar: cobrar no Pix" card is as in the prototype', () => {
  expect(
    chargeCard({ customerName: 'João Pereira', service: 'Limpeza de split + troca de capacitor', amountCents: 35000 }),
  ).toEqual({
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
});

test('the Pix goes with the amount and the Charge id in the code, and the "Já paguei" button', async () => {
  const professional = await professionalWithBilling();

  const { charge, sent } = await chargeSent(professional);

  expect(charge).toMatchObject({ status: 'pending', paymentMethod: 'pix', amountCents: 35000 });
  expect(charge.sentAt).toBeInstanceOf(Date);
  expect(sent).toMatchObject({ type: 'template', originType: 'charge', originId: charge.id });
  const template = (sent.payload as { template: { name: string; components: { parameters: object[] }[] } }).template;
  expect(template.name).toBe('pix_charge');
  const code = (template.components[0]!.parameters.at(-1) as { text: string }).text;
  const pix = parsePix(code);
  expect(hasError(pix)).toBe(false);
  expect(pix).toMatchObject({
    pixKey: 'carlos@example.com',
    transactionAmount: 350,
    txid: charge.id.replaceAll('-', '').slice(0, 25),
  });
  expect(template.components[1]).toMatchObject({ type: 'button', parameters: [{ payload: 'paid' }] });
});

test('"Já paguei" puts the Charge in awaiting_confirmation and tells the billing Assistant to ask "Recebi / Não caiu"', async () => {
  const professional = await professionalWithBilling();
  const { charge, sent } = await chargeSent(professional);

  const click = await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  expect(click.data?.webhook?.status).toBe(200);
  expect((await findCharge(professional.professional.id, charge.id))!.status).toBe('awaiting_confirmation');
  expect(await noticesOf(professional)).toEqual([
    expect.stringMatching(/^João Pereira tocou em Já paguei no Pix de R\$\s350,00\. .*Recebi ou Não caiu\?$/),
  ]);
});

test('"Recebi" marks the Charge paid and concludes the Job; it cannot be answered twice', async () => {
  const professional = await professionalWithBilling();
  const { charge, sent } = await chargeSent(professional);
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const result = await confirmChargePaid(professional.professional.id, charge.id, true);

  expect(result).toMatchObject({ charge: { status: 'paid', paidAt: expect.any(Date) } });
  expect(await confirmChargePaid(professional.professional.id, charge.id, false)).toEqual({ refused: 'already_paid' });
});

test('"Não caiu" puts the Charge back to pending, and a later "Já paguei" asks again', async () => {
  const professional = await professionalWithBilling();
  const { charge, sent } = await chargeSent(professional);
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const result = await confirmChargePaid(professional.professional.id, charge.id, false);
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  expect(result).toMatchObject({ charge: { status: 'pending' } });
  expect((await findCharge(professional.professional.id, charge.id))!.status).toBe('awaiting_confirmation');
  expect(await noticesOf(professional)).toHaveLength(2);
});

test('without the Pix key there is no account to charge to, and a WorkRecord without Customer or amount is not charged', async () => {
  const withoutKey = await professionalWithBilling({ pixKey: false });
  expect(await findPixAccount(withoutKey.professional.id)).toBeNull();

  const professional = await professionalWithBilling();
  const incomplete = await workRecordFor(professional.professional.id, null, null);
  expect(await createCharge(professional.professional.id, incomplete.id)).toEqual({
    refused: 'work_record_incomplete',
  });
  expect(await db.select().from(charges).where(eq(charges.workRecordId, incomplete.id))).toEqual([]);
});

test('two Confirmar at once make one Pix Charge', async () => {
  const professional = await professionalWithBilling();
  const workRecord = await workRecordFor(professional.professional.id, professional.joao.id);

  const created = await Promise.all(
    Array.from({ length: 5 }, () => createCharge(professional.professional.id, workRecord.id)),
  );

  const saved = await db.select().from(charges).where(eq(charges.workRecordId, workRecord.id));
  expect(saved).toHaveLength(1);
  expect(created.map((result) => result.charge?.id)).toEqual(Array(5).fill(saved[0]!.id));
});
