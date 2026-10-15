import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { signInNewProfessional } from '../auth/test-auth';
import { extractWorkRecord } from './extract';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
const joaoPereira = { id: randomUUID(), name: 'João Pereira' };
const joaoSilva = { id: randomUUID(), name: 'João Silva' };
const carlosSantos = { id: randomUUID(), name: 'Carlos Santos' };
const marta = { id: randomUUID(), name: 'Marta Ribeiro' };
const visitToJoaoPereira = {
  id: randomUUID(),
  customerId: joaoPereira.id,
  customerName: joaoPereira.name,
  when: 'quarta-feira, 14/10, às 14:00',
};

async function extract(transcript: string) {
  const { professional } = await signInNewProfessional();
  return extractWorkRecord(
    {
      professionalId: professional.id,
      assistantId: null,
      customers: [carlosSantos, joaoPereira, joaoSilva, marta],
      visits: [visitToJoaoPereira],
      paymentMethods: { accepted: ['pix', 'cash'], default: 'pix' },
    },
    transcript,
  );
}

describe('the WorkRecord extraction', () => {
  test('"troquei o capacitor do João, 350 no Pix" picks the João with the recent Visit, in cents', async () => {
    const extraction = await extract('troquei o capacitor do João, 350 no Pix');

    expect(extraction).toMatchObject({
      customerId: joaoPereira.id,
      newCustomer: null,
      visitId: visitToJoaoPereira.id,
      amountCents: 35000,
      paymentMethod: 'pix',
    });
  });

  test('a Customer outside the list becomes a newCustomer, not the one with a similar name', async () => {
    const extraction = await extract('fiz a limpeza de dois split, foi do Carlos Souza, cobrei 300 no pix');

    expect(extraction.customerId).toBeNull();
    expect(extraction.newCustomer).toEqual({ name: 'Carlos Souza', phoneNumber: null });
    expect(extraction.amountCents).toBe(30000);
  });

  test('the WhatsApp said in a later message comes with the new Customer name', async () => {
    const extraction = await extract(
      'fiz a limpeza de dois split, foi do Carlos Souza, cobrei 300 no pix\no zap dele é 11 98765-4321',
    );

    expect(extraction.customerId).toBeNull();
    expect(extraction.newCustomer?.name).toBe('Carlos Souza');
    expect(extraction.newCustomer?.phoneNumber?.replace(/\D/g, '')).toEndWith('11987654321');
  });

  test('cash already received is recorded as received', async () => {
    const extraction = await extract(
      'é... terminei lá na Marta, limpeza do split da sala, ela já me pagou duzentos em dinheiro',
    );

    expect(extraction).toMatchObject({
      customerId: marta.id,
      amountCents: 20000,
      paymentMethod: 'cash',
      cashReceived: true,
    });
  });

  test('an account without an amount leaves it blank and keeps the materials', async () => {
    const extraction = await extract(
      'então, fiz a instalação do split na casa do João Silva, usei dois metros de tubo de cobre e um suporte, o valor eu vejo depois',
    );

    expect(extraction.customerId).toBe(joaoSilva.id);
    expect(extraction.amountCents).toBeNull();
    expect(extraction.materials).toMatch(/cobre/i);
  });

  test('a correction in a later message wins over the audio', async () => {
    const extraction = await extract('troquei o capacitor do João Pereira, 350 no Pix\nopa, foi 380, não 350');

    expect(extraction).toMatchObject({ customerId: joaoPereira.id, amountCents: 38000 });
  });
});
