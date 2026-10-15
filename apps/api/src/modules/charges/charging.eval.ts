import { describe, expect, test } from 'bun:test';
import { charges, db, workRecords } from '@acme/db';
import { eq } from 'drizzle-orm';
import { formatMoney } from '../briefing/scripts';
import { called, customerOf, notice, say, scriptedAssistant } from '../conversations/scripted-conversation';
import type { Assistant } from '../conversations/service';
import { createCharge } from './service';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const pixAccount = {
  paymentMethods: { accepted: ['pix', 'cash'], default: 'pix' },
  pixKey: { type: 'email', key: 'carlos@example.com' },
  pixName: 'Carlos Souza',
  pixCity: 'Campinas',
};

async function serviceFor(
  assistant: Assistant,
  customerId: string,
  { title = 'Limpeza de split', amountCents = 35000 } = {},
) {
  const [workRecord] = await db
    .insert(workRecords)
    .values({ professionalId: assistant.professional.id, customerId, title, amountCents, paymentMethod: 'pix' })
    .returning();
  return workRecord!;
}

// The Pix went out and João tapped "Já paguei": the app put the Charge on hold and told the Assistant.
async function chargeAwaitingConfirmation(assistant: Assistant) {
  const joao = await customerOf(assistant, 'João Pereira');
  const created = await createCharge(assistant.professional.id, (await serviceFor(assistant, joao.id)).id);
  if (!created.charge) throw new Error(`No Charge: ${created.refused}`);
  await db
    .update(charges)
    .set({ status: 'awaiting_confirmation', sentAt: new Date() })
    .where(eq(charges.id, created.charge.id));
  await notice(
    assistant,
    `João Pereira tocou em Já paguei no Pix de ${formatMoney(35000)}. Confira no app do banco: Recebi ou Não caiu?`,
  );
  return created.charge;
}

describe('the billing Assistant', () => {
  test('"cobra o João" charges his service and sends the Pix', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    const joao = await customerOf(assistant, 'João Pereira');
    const maria = await customerOf(assistant, 'Maria Lima');
    const service = await serviceFor(assistant, joao.id);
    await serviceFor(assistant, maria.id, { title: 'Instalação de split', amountCents: 45000 });

    const turn = await say(assistant, 'cobra o joão');

    expect(turn.calls).toContainEqual(called('listCharges'));
    expect(turn.calls).toContainEqual(called('createCharge', { workRecordId: service.id }));
    const [charge] = await db.select().from(charges).where(eq(charges.workRecordId, service.id));
    expect(turn.calls).toContainEqual(called('sendCharge', { chargeId: charge?.id }));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test('two services of the same Customer make it ask which one', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    const joao = await customerOf(assistant, 'João Pereira');
    await serviceFor(assistant, joao.id);
    await serviceFor(assistant, joao.id, { title: 'Troca de compressor', amountCents: 120000 });

    const turn = await say(assistant, 'cobra o João');

    expect(turn.calls).toContainEqual(called('listCharges'));
    expect(turn.calls).not.toContainEqual(called('createCharge'));
    expect(turn.calls).not.toContainEqual(called('sendCharge'));
  });

  test('a service that was never recorded asks for Registrar serviço instead of inventing a Charge', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    await customerOf(assistant, 'Marta Ribeiro');

    const turn = await say(assistant, 'cobra a marta dos 200 de ontem');

    expect(turn.calls).not.toContainEqual(called('createCharge'));
    expect(turn.calls).not.toContainEqual(called('sendCharge'));
    expect(turn.reply).toMatch(/registrar servi[çc]o/i);
  });

  test('a transcribed audio about "a dona Cida da limpeza" charges her service', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    const cida = await customerOf(assistant, 'Aparecida Santos');
    const joao = await customerOf(assistant, 'João Pereira');
    const service = await serviceFor(assistant, cida.id, { title: 'Limpeza de split', amountCents: 20000 });
    await serviceFor(assistant, joao.id, { title: 'Instalação de split', amountCents: 45000 });

    const turn = await say(
      assistant,
      'é, aquela limpeza da dona Aparecida, a Cida, que eu fiz, manda o pix dela aí por favor',
    );

    expect(turn.calls).toContainEqual(called('createCharge', { workRecordId: service.id }));
    expect(turn.calls).toContainEqual(called('sendCharge'));
  });

  test('after "Já paguei", "caiu sim" marks the Charge paid', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    const charge = await chargeAwaitingConfirmation(assistant);

    const turn = await say(assistant, 'caiu sim');

    expect(turn.calls).toContainEqual(called('confirmChargePaid', { chargeId: charge.id, received: true }));
  });

  test('after "Já paguei", "não caiu nada" puts the Charge back to pending', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    const charge = await chargeAwaitingConfirmation(assistant);

    const turn = await say(assistant, 'olhei aqui e não caiu nada');

    expect(turn.calls).toContainEqual(called('confirmChargePaid', { chargeId: charge.id, received: false }));
    expect(turn.calls).not.toContainEqual(called('confirmChargePaid', { received: true }));
  });

  test('the "Já paguei" notice alone does not mark the Charge paid', async () => {
    const assistant = await scriptedAssistant('billing', pixAccount);
    await chargeAwaitingConfirmation(assistant);

    const turn = await say(assistant, 'bom dia! quanto eu tenho pra receber?');

    expect(turn.calls).not.toContainEqual(called('confirmChargePaid'));
  });
});
