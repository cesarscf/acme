import { afterAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistants, audioUsages, charges, db, llmUsages, whatsappMessages } from '@acme/db';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { and, eq } from 'drizzle-orm';
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

function filled(output: object) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
}

test('the audio "troquei o capacitor do João, 350 no Pix" fills Customer, Visit, description, amount and Pix', async () => {
  const { professional, headers } = await professionalWith();
  await newCustomer(professional.id, 'Marta Lima');
  const joao = await newCustomer(professional.id, 'João Pereira');
  const visit = await createVisit(professional.id, joao.id, {
    scheduledAt: new Date(Date.now() - 2 * 3_600_000),
    durationMinutes: 60,
  });
  openRouter.transcribe('Troquei o capacitor do João, 350 no Pix.', 6.5);
  claude.reply((request) =>
    filled({
      customer: refOf(request, 'João Pereira'),
      visit: refOf(request, 'João Pereira,'),
      description: 'Troca do capacitor',
      materials: null,
      amountCents: 35000,
      paymentMethod: 'pix',
    }),
  );

  const { data, status } = await api['work-records'].draft.post({ audio }, { headers });

  expect(status).toBe(200);
  expect(data).toEqual({
    transcript: 'Troquei o capacitor do João, 350 no Pix.',
    draft: {
      customerId: joao.id,
      visitId: visit.id,
      description: 'Troca do capacitor',
      materials: null,
      amountCents: 35000,
      paymentMethod: 'pix',
    },
  });
  const request = claude.requests.at(-1)!;
  expect(userContent(request)).toContain('<relato>Troquei o capacitor do João, 350 no Pix.</relato>');
  expect(userContent(request)).toContain('Formas aceitas: pix (Pix), cash (dinheiro)');
  const [audioUsage] = await db.select().from(audioUsages).where(eq(audioUsages.professionalId, professional.id));
  expect(audioUsage).toMatchObject({ seconds: 6.5, model: 'openai/whisper-large-v3-turbo' });
  expect(await db.select().from(llmUsages).where(eq(llmUsages.professionalId, professional.id))).toHaveLength(1);
});

test("what Claude cannot back up stays blank, and the PaymentMethod falls back to the billing Assistant's default", async () => {
  const { professional, headers } = await professionalWith({
    paymentMethods: { accepted: ['pix', 'cash'], default: 'cash' },
  });
  await newCustomer(professional.id, 'João Pereira');
  openRouter.transcribe('Limpei o split do Carlos.');
  claude.reply(
    filled({
      customer: 'C99',
      visit: 'V7',
      description: ' Limpeza do split ',
      materials: '',
      amountCents: -10,
      paymentMethod: null,
    }),
  );

  const { data } = await api['work-records'].draft.post({ audio }, { headers });

  expect(data!.draft).toEqual({
    customerId: null,
    visitId: null,
    description: 'Limpeza do split',
    materials: null,
    amountCents: null,
    paymentMethod: 'cash',
  });
});

test('a transcription error answers 502 without calling Claude, and trying again works', async () => {
  const { professional, headers } = await professionalWith();
  const requests = claude.requests.length;
  openRouter.fail(503);

  const failed = await api['work-records'].draft.post({ audio }, { headers });

  expect(failed.status).toBe(502);
  expect(claude.requests.length).toBe(requests);
  expect(await db.select().from(audioUsages).where(eq(audioUsages.professionalId, professional.id))).toEqual([]);

  openRouter.transcribe('Troquei o capacitor.');
  claude.reply(
    filled({
      customer: null,
      visit: null,
      description: 'Troca do capacitor',
      materials: null,
      amountCents: null,
      paymentMethod: null,
    }),
  );
  const retried = await api['work-records'].draft.post({ audio }, { headers });
  expect(retried.status).toBe(200);
  expect(retried.data!.draft.description).toBe('Troca do capacitor');
});

test('the audio needs the AI consent', async () => {
  const { headers } = await professionalWith({ consent: false });

  const { status } = await api['work-records'].draft.post({ audio }, { headers });

  expect(status).toBe(403);
});

test('saving in cash already received makes a paid Charge and sends nothing to the Customer', async () => {
  const { professional, headers } = await professionalWith({ consent: false });
  const joao = await newCustomer(professional.id, 'João Pereira');

  const { data, status } = await api['work-records'].post(
    {
      customerId: joao.id,
      visitId: null,
      description: 'Troca do capacitor',
      materials: '2 metros de cobre',
      amountCents: 35000,
      paymentMethod: 'cash',
      received: true,
    },
    { headers },
  );

  expect(status).toBe(200);
  expect(data!.workRecord).toMatchObject({ customerId: joao.id, amountCents: 35000, paymentMethod: 'cash' });
  expect(data!.charge).toMatchObject({
    workRecordId: data!.workRecord.id,
    customerId: joao.id,
    amountCents: 35000,
    paymentMethod: 'cash',
    status: 'paid',
  });
  expect(data!.charge!.paidAt).toBeTruthy();
  expect(await db.select().from(whatsappMessages).where(eq(whatsappMessages.waId, joao.phoneNumber))).toEqual([]);
});

test('the form works without audio: it lists the recent Visits and saves Pix or cash not yet received without a Charge', async () => {
  const { professional, headers } = await professionalWith({ consent: false });
  const joao = await newCustomer(professional.id, 'João Pereira');
  const visit = await createVisit(professional.id, joao.id, { scheduledAt: new Date(), durationMinutes: 60 });
  await createVisit(professional.id, joao.id, {
    scheduledAt: new Date(Date.now() + 10 * 86_400_000),
    durationMinutes: 60,
  });

  const { data: form } = await api['work-records'].new.get({ headers });
  const pix = await api['work-records'].post(
    {
      customerId: joao.id,
      visitId: visit.id,
      description: 'Troca do capacitor',
      materials: null,
      amountCents: 35000,
      paymentMethod: 'pix',
    },
    { headers },
  );
  const cash = await api['work-records'].post(
    {
      customerId: joao.id,
      visitId: null,
      description: 'Limpeza do split',
      materials: null,
      amountCents: 20000,
      paymentMethod: 'cash',
      received: false,
    },
    { headers },
  );

  expect(form).toEqual({
    paymentMethods: { accepted: ['pix', 'cash'], default: 'pix' },
    visits: [{ id: visit.id, customerId: joao.id, customerName: 'João Pereira', when: expect.any(String) }],
  });
  expect(pix.data).toMatchObject({ workRecord: { visitId: visit.id, paymentMethod: 'pix' }, charge: null });
  expect(cash.data).toMatchObject({ workRecord: { paymentMethod: 'cash' }, charge: null });
  expect(await db.select().from(charges).where(eq(charges.professionalId, professional.id))).toEqual([]);
});

test("the form refuses another Professional's Customer, a Visit of another Customer and a PaymentMethod the billing Assistant does not take", async () => {
  const { professional, headers } = await professionalWith({
    consent: false,
    paymentMethods: { accepted: ['pix'], default: 'pix' },
  });
  const other = await signInNewProfessional();
  const stranger = await newCustomer(other.professional.id, 'Outro');
  const joao = await newCustomer(professional.id, 'João Pereira');
  const marta = await newCustomer(professional.id, 'Marta Lima');
  const visit = await createVisit(professional.id, marta.id, { scheduledAt: new Date(), durationMinutes: 60 });
  const record = {
    customerId: joao.id,
    visitId: null,
    description: 'Troca do capacitor',
    materials: null,
    amountCents: 35000,
    paymentMethod: 'pix' as const,
  };

  const strangers = await api['work-records'].post({ ...record, customerId: stranger.id }, { headers });
  const wrongVisit = await api['work-records'].post({ ...record, visitId: visit.id }, { headers });
  const cash = await api['work-records'].post({ ...record, paymentMethod: 'cash', received: true }, { headers });

  expect(strangers.status).toBe(404);
  expect(wrongVisit.status).toBe(404);
  expect(cash.status).toBe(422);
  const saved = await db
    .select()
    .from(charges)
    .where(and(eq(charges.professionalId, professional.id), eq(charges.customerId, joao.id)));
  expect(saved).toEqual([]);
});
