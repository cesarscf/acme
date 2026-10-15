import { afterAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistants, audioUsages, charges, db, llmUsages, whatsappMessages, workRecords } from '@acme/db';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { createCustomer } from '../customers/service';
import { startFakeOpenRouter } from '../transcription/fake-openrouter';
import { createVisit } from '../visits/service';

const api = treaty(app);
const claude = startFakeClaude();
const openRouter = startFakeOpenRouter();
const audio = new File(
  [await Bun.file(`${import.meta.dir}/../transcription/fixtures/silence.m4a`).arrayBuffer()],
  'audio.m4a',
  {
    type: 'audio/mp4',
  },
);

afterAll(() => {
  claude.stop();
  openRouter.stop();
});

async function professionalWith({
  consent = true,
  paymentMethods,
}: {
  consent?: boolean;
  paymentMethods?: object;
} = {}) {
  const signedIn = await signInNewProfessional();
  if (consent) await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
  await api.team.post({ roles: ['billing'] }, { headers: signedIn.headers });
  if (paymentMethods)
    await db
      .update(assistants)
      .set({ playbook: { paymentMethods } })
      .where(eq(assistants.professionalId, signedIn.professional.id));
  return signedIn;
}

async function newCustomer(professionalId: string, name: string) {
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  return (await createCustomer(professionalId, { name, phoneNumber })).customer;
}

function userContent(request: Anthropic.Beta.MessageCreateParams) {
  return request.messages[0]!.content as string;
}

// The reference the prompt gave to a line, e.g. "C2" for "- C2: João Pereira".
function refOf(request: Anthropic.Beta.MessageCreateParams, line: string) {
  return new RegExp(`- ([CV]\\d+): ${line}`).exec(userContent(request))![1]!;
}

function filled(output: Partial<Record<string, unknown>>) {
  const empty = {
    customer: null,
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

test('the audio is transcribed and its usage recorded, without Claude yet', async () => {
  const { professional, headers } = await professionalWith();
  const requests = claude.requests.length;
  openRouter.transcribe('Troquei o capacitor do João, 350 no Pix.', 6.5);

  const { data, status } = await api['work-records'].transcription.post({ audio }, { headers });

  expect(status).toBe(200);
  expect(data).toEqual({ transcript: 'Troquei o capacitor do João, 350 no Pix.' });
  expect(claude.requests.length).toBe(requests);
  const [audioUsage] = await db.select().from(audioUsages).where(eq(audioUsages.professionalId, professional.id));
  expect(audioUsage).toMatchObject({ seconds: 6.5, model: 'openai/whisper-large-v3-turbo' });
});

test('a transcription error answers 502 and trying the same audio again works; silence answers 422', async () => {
  const { professional, headers } = await professionalWith();
  openRouter.fail(503);

  const failed = await api['work-records'].transcription.post({ audio }, { headers });

  expect(failed.status).toBe(502);
  expect(await db.select().from(audioUsages).where(eq(audioUsages.professionalId, professional.id))).toEqual([]);
  openRouter.transcribe('Troquei o capacitor.');
  const retried = await api['work-records'].transcription.post({ audio }, { headers });
  expect(retried.data).toEqual({ transcript: 'Troquei o capacitor.' });
  openRouter.transcribe('');
  expect((await api['work-records'].transcription.post({ audio }, { headers })).status).toBe(422);
});

test('the audio and the WorkRecord need the AI consent', async () => {
  const { headers } = await professionalWith({ consent: false });

  const transcription = await api['work-records'].transcription.post({ audio }, { headers });
  const created = await api['work-records'].post({ transcript: 'Troquei o capacitor.' }, { headers });

  expect(transcription.status).toBe(403);
  expect(created.status).toBe(403);
});

test('"troquei o capacitor do João, 350 no Pix" is saved straight away with Customer, Visit, service, amount and Pix', async () => {
  const { professional, headers } = await professionalWith();
  await newCustomer(professional.id, 'Marta Lima');
  const joao = await newCustomer(professional.id, 'João Pereira');
  const visit = await createVisit(professional.id, joao.id, {
    scheduledAt: new Date(Date.now() - 2 * 3_600_000),
    durationMinutes: 60,
  });
  claude.reply((request) =>
    filled({
      customer: refOf(request, 'João Pereira'),
      visit: refOf(request, 'João Pereira,'),
      title: 'Troca de capacitor',
      description: 'Troca do capacitor do ar-condicionado',
      materials: '1 capacitor 35 µF',
      amountCents: 35000,
      paymentMethod: 'pix',
    }),
  );

  const { data, status } = await api['work-records'].post(
    { transcript: 'Troquei o capacitor do João, 350 no Pix.' },
    { headers },
  );

  expect(status).toBe(200);
  expect(data).toMatchObject({
    customer: { id: joao.id, name: 'João Pereira' },
    title: 'Troca de capacitor',
    description: 'Troca do capacitor do ar-condicionado',
    materials: '1 capacitor 35 µF',
    amountCents: 35000,
    paymentMethod: 'pix',
    paid: false,
    transcript: 'Troquei o capacitor do João, 350 no Pix.',
    customerOptions: [],
  });
  const [saved] = await db.select().from(workRecords).where(eq(workRecords.id, data!.id));
  expect(saved!.visitId).toBe(visit.id);
  const request = claude.requests.at(-1)!;
  expect(userContent(request)).toContain('<relato>Troquei o capacitor do João, 350 no Pix.</relato>');
  expect(userContent(request)).toContain('Formas aceitas: pix (Pix), cash (dinheiro)');
  expect(await db.select().from(llmUsages).where(eq(llmUsages.professionalId, professional.id))).toHaveLength(1);
  expect(await db.select().from(charges).where(eq(charges.workRecordId, data!.id))).toEqual([]);
});

test("what Claude cannot back up stays blank, and the PaymentMethod falls back to the billing Assistant's default", async () => {
  const { professional, headers } = await professionalWith({
    paymentMethods: { accepted: ['pix', 'cash'], default: 'cash' },
  });
  await newCustomer(professional.id, 'João Pereira');
  claude.reply(
    filled({ customer: 'C99', visit: 'V7', description: ' Limpeza do split ', materials: '', amountCents: -10 }),
  );

  const { data } = await api['work-records'].post({ transcript: 'Limpei o split do Carlos.' }, { headers });

  expect(data).toMatchObject({
    customer: null,
    title: null,
    description: 'Limpeza do split',
    materials: null,
    amountCents: null,
    paymentMethod: 'cash',
    paid: false,
  });
});

test('cash already received makes a paid Charge and sends nothing to the Customer', async () => {
  const { professional, headers } = await professionalWith();
  const joao = await newCustomer(professional.id, 'João Pereira');
  claude.reply((request) =>
    filled({
      customer: refOf(request, 'João Pereira'),
      title: 'Troca de capacitor',
      amountCents: 35000,
      paymentMethod: 'cash',
      cashReceived: true,
    }),
  );

  const { data } = await api['work-records'].post(
    { transcript: 'Troquei o capacitor do João, ele já me pagou 350 em dinheiro.' },
    { headers },
  );

  expect(data!.paid).toBe(true);
  const [charge] = await db.select().from(charges).where(eq(charges.workRecordId, data!.id));
  expect(charge).toMatchObject({ customerId: joao.id, amountCents: 35000, paymentMethod: 'cash', status: 'paid' });
  expect(charge!.paidAt).toBeTruthy();
  expect(await db.select().from(whatsappMessages).where(eq(whatsappMessages.waId, joao.phoneNumber))).toEqual([]);
});

test('without a Customer the thread offers the likely ones, and picking one completes it, paid Charge included', async () => {
  const { professional, headers } = await professionalWith();
  const other = await signInNewProfessional();
  const stranger = await newCustomer(other.professional.id, 'Outro');
  const joao = await newCustomer(professional.id, 'João Pereira');
  const marta = await newCustomer(professional.id, 'Marta Lima');
  await createVisit(professional.id, joao.id, { scheduledAt: new Date(), durationMinutes: 60 });
  claude.reply(filled({ title: 'Limpeza de split', amountCents: 20000, paymentMethod: 'cash', cashReceived: true }));

  const { data: created } = await api['work-records'].post(
    { transcript: 'Limpei o split, recebi 200 em dinheiro.' },
    { headers },
  );
  const strangers = await api['work-records']({ id: created!.id }).patch({ customerId: stranger.id }, { headers });
  const { data: chosen } = await api['work-records']({ id: created!.id }).patch({ customerId: joao.id }, { headers });

  expect(created).toMatchObject({ customer: null, paid: false });
  expect(created!.customerOptions).toEqual([
    { id: joao.id, name: 'João Pereira' },
    { id: marta.id, name: 'Marta Lima' },
  ]);
  expect(strangers.status).toBe(404);
  expect(chosen).toMatchObject({ customer: { id: joao.id }, paid: true, customerOptions: [] });
});

test('a message in the thread is read with the whole account and completes what was missing', async () => {
  const { professional, headers } = await professionalWith();
  const joao = await newCustomer(professional.id, 'João Pereira');
  claude.reply(filled({ title: 'Limpeza de split', amountCents: 35000, paymentMethod: 'pix' }));
  const { data: created } = await api['work-records'].post({ transcript: 'Limpei o split, 350 no Pix.' }, { headers });
  claude.reply((request) => filled({ customer: refOf(request, 'João Pereira'), title: 'Limpeza completa de split' }));

  const { data, status } = await api['work-records']({ id: created!.id }).messages.post(
    { text: 'Foi na casa do João.' },
    { headers },
  );

  expect(status).toBe(200);
  expect(userContent(claude.requests.at(-1)!)).toContain(
    '<relato>Limpei o split, 350 no Pix.\nFoi na casa do João.</relato>',
  );
  expect(data).toMatchObject({
    customer: { id: joao.id },
    title: 'Limpeza completa de split',
    amountCents: 35000,
    paymentMethod: 'pix',
    transcript: 'Limpei o split, 350 no Pix.\nFoi na casa do João.',
  });
});

test("the Serviços list shows the Professional's WorkRecords, newest first, and another Professional cannot open them", async () => {
  const { professional, headers } = await professionalWith();
  const joao = await newCustomer(professional.id, 'João Pereira');
  claude.reply((request) =>
    filled({ customer: refOf(request, 'João Pereira'), title: 'Limpeza de split', amountCents: 35000 }),
  );
  const { data: first } = await api['work-records'].post({ transcript: 'Limpei o split do João, 350.' }, { headers });
  claude.reply(filled({ title: 'Troca de capacitor' }));
  const { data: second } = await api['work-records'].post({ transcript: 'Troquei um capacitor.' }, { headers });
  const other = await signInNewProfessional();

  const { data: list } = await api['work-records'].get({ headers });
  const opened = await api['work-records']({ id: first!.id }).get({ headers: other.headers });

  expect(list).toEqual([
    {
      id: second!.id,
      createdAt: expect.any(Date),
      title: 'Troca de capacitor',
      amountCents: null,
      customerName: null,
      paid: false,
    },
    {
      id: first!.id,
      createdAt: expect.any(Date),
      title: 'Limpeza de split',
      amountCents: 35000,
      customerName: joao.name,
      paid: false,
    },
  ]);
  expect(opened.status).toBe(404);
});
