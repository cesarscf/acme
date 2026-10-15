import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistants, charges, db, workRecords } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { eq } from 'drizzle-orm';
import { type Assistant, findAssistant } from '../conversations/service';
import { newAssistant, runTool } from '../conversations/test-tools';
import { createCustomer } from '../customers/service';
import { listMessages } from '../whatsapp/service';
import { ensureChargeTemplates } from './service';
import { chargeTools } from './tools';

const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: 'http://localhost:1/webhooks/whatsapp',
}).listen(0);
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureChargeTemplates();
});

afterAll(async () => {
  await emulator.stop();
});

const pixAccount = {
  pixKey: { type: 'email', key: 'carlos@example.com' },
  pixName: 'Carlos Souza',
  pixCity: 'Campinas',
};

async function billingAssistantWithService({ pixKey = true } = {}) {
  const created = await newAssistant('billing');
  if (pixKey) await db.update(assistants).set({ playbook: pixAccount }).where(eq(assistants.id, created.id));
  const billingAssistant = (await findAssistant(created.professional.id, created.id))!;
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const { customer: joao } = await createCustomer(billingAssistant.professional.id, {
    name: 'João Pereira',
    phoneNumber,
  });
  const [workRecord] = await db
    .insert(workRecords)
    .values({
      professionalId: billingAssistant.professional.id,
      customerId: joao.id,
      title: 'Limpeza de split',
      amountCents: 35000,
      paymentMethod: 'pix',
    })
    .returning();
  return { billingAssistant, joao, workRecord: workRecord! };
}

function idIn(text: string) {
  return (JSON.parse(text.slice(text.indexOf('{'))) as { id: string }).id;
}

async function createCharge(billingAssistant: Assistant, workRecordId: string) {
  return runTool(chargeTools(billingAssistant), 'createCharge', { workRecordId });
}

test('listCharges shows the unpaid services, and createCharge makes one Pix Charge per service, not sent yet', async () => {
  const { billingAssistant, joao, workRecord } = await billingAssistantWithService();

  const listed = await runTool(chargeTools(billingAssistant), 'listCharges', {});
  const first = await createCharge(billingAssistant, workRecord.id);
  const second = await createCharge(billingAssistant, workRecord.id);

  expect(JSON.parse(listed.text)).toEqual([
    expect.objectContaining({ workRecordId: workRecord.id, service: 'Limpeza de split', charge: null }),
  ]);
  expect(first.text).toStartWith('Cobrança montada, ainda não enviada');
  expect(idIn(second.text)).toBe(idIn(first.text));
  const stored = await db.select().from(charges).where(eq(charges.workRecordId, workRecord.id));
  expect(stored).toEqual([expect.objectContaining({ status: 'pending', sentAt: null, amountCents: 35000 })]);
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([]);
});

test('sendCharge shows the prototype card and, once run, sends the Pix to the Customer', async () => {
  const { billingAssistant, joao, workRecord } = await billingAssistantWithService();
  const chargeId = idIn((await createCharge(billingAssistant, workRecord.id)).text);
  const sendCharge = chargeTools(billingAssistant).find(({ tool }) => tool.name === 'sendCharge')!;

  const card = await sendCharge.card!({ chargeId });
  const sent = await runTool(chargeTools(billingAssistant), 'sendCharge', { chargeId });

  expect(card).toMatchObject({
    title: 'Para confirmar: cobrar no Pix',
    question: expect.stringMatching(/^Confirma: cobrar R\$\s350 do João\?$/),
  });
  expect(sent).toEqual({ text: 'Pix enviado para João Pereira no WhatsApp.', isError: false });
  expect(await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber })).toEqual([
    expect.objectContaining({ originType: 'charge', originId: chargeId }),
  ]);
  const listed = JSON.parse((await runTool(chargeTools(billingAssistant), 'listCharges', {})).text);
  expect(listed[0].charge).toEqual({ id: chargeId, status: 'pending', sent: true });
});

test('confirmChargePaid with Recebi marks the Charge paid and the service leaves listCharges', async () => {
  const { billingAssistant, workRecord } = await billingAssistantWithService();
  const chargeId = idIn((await createCharge(billingAssistant, workRecord.id)).text);

  const notReceived = await runTool(chargeTools(billingAssistant), 'confirmChargePaid', { chargeId, received: false });
  const received = await runTool(chargeTools(billingAssistant), 'confirmChargePaid', { chargeId, received: true });
  const again = await runTool(chargeTools(billingAssistant), 'confirmChargePaid', { chargeId, received: true });

  expect(notReceived.text).toContain('não caiu');
  expect(received.text).toMatch(/^Pago: R\$\s350,00 de João Pereira\.$/);
  expect(again.isError).toBe(true);
  const [charge] = await db.select().from(charges).where(eq(charges.id, chargeId));
  expect(charge).toMatchObject({ status: 'paid', paidAt: expect.any(Date) });
  expect((await runTool(chargeTools(billingAssistant), 'listCharges', {})).text).toBe('Nenhum serviço a receber.');
});

test('without the Pix key in the Playbook, createCharge asks for the Briefing first', async () => {
  const { billingAssistant, workRecord } = await billingAssistantWithService({ pixKey: false });

  const result = await createCharge(billingAssistant, workRecord.id);

  expect(result.isError).toBe(true);
  expect(result.text).toContain('Falta a chave Pix');
  expect(await db.select().from(charges).where(eq(charges.workRecordId, workRecord.id))).toEqual([]);
});
