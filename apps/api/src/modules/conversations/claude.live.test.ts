import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistants, customers, db, llmUsages, visits } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { catalogEntry } from '../team/catalog';
import { ensureVisitConfirmationTemplate } from '../visits/service';
import { listMessages } from '../whatsapp/service';

// Calls the real Claude API and spends tokens, so it runs only with `bun run test:claude`.
describe.skipIf(!process.env.CLAUDE_LIVE)('the Assistant on the real Claude API', () => {
  const api = treaty(app);
  const emulator = createEmulator({
    appSecret: process.env.META_APP_SECRET!,
    verifyToken: process.env.META_VERIFY_TOKEN!,
    webhookUrl: 'http://localhost:0/webhooks/whatsapp',
  });

  beforeAll(async () => {
    emulator.listen(0);
    process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
    await ensureVisitConfirmationTemplate();
  });

  afterAll(() => emulator.stop());

  async function schedulingAssistantForNewProfessional() {
    const signedIn = await signInNewProfessional();
    await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
    await api.team.post({ roles: ['scheduling'] }, { headers: signedIn.headers });
    const { data: team } = await api.team.get({ headers: signedIn.headers });
    return { ...signedIn, schedulingAssistant: team![0]! };
  }

  async function drain<T>(request: Promise<{ data: AsyncIterable<{ data: T }> | null; error: unknown }>) {
    const { data, error } = await request;
    expect(error).toBeNull();
    const events: T[] = [];
    for await (const event of data!) events.push(event.data);
    return events;
  }

  test('the scheduling Assistant answers in Portuguese and the tokens are recorded', async () => {
    const { professional, headers, schedulingAssistant } = await schedulingAssistantForNewProfessional();

    const events = await drain(
      api.team({ id: schedulingAssistant.id }).messages.post({ text: 'Oi! Qual é o seu nome?' }, { headers }),
    );

    expect(events.at(-1)).toEqual({ type: 'done' });
    const { data } = await api.team({ id: schedulingAssistant.id }).messages.get({ headers });
    const reply = data!.items.at(-1)!;
    expect(reply.type).toBe('assistant');
    expect(reply.type === 'assistant' && reply.text).toContain(catalogEntry('scheduling').name);
    const [usage] = await db.select().from(llmUsages).where(eq(llmUsages.professionalId, professional.id));
    expect(usage).toMatchObject({
      assistantId: schedulingAssistant.id,
      model: expect.stringContaining('claude-haiku-5-5'),
    });
    expect(usage!.inputTokens).toBeGreaterThan(0);
    expect(usage!.outputTokens).toBeGreaterThan(0);
  }, 60_000);

  test('"Marca o João amanhã às 14h" books the Visit, and the confirmation waits for Confirmar', async () => {
    const { professional, headers, schedulingAssistant } = await schedulingAssistantForNewProfessional();
    const customer = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
    const from = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

    await drain(
      api
        .team({ id: schedulingAssistant.id })
        .messages.post({ text: `Marca o João Pereira amanhã às 14h. O WhatsApp dele é ${customer}.` }, { headers }),
    );

    const [joao] = await db.select().from(customers).where(eq(customers.professionalId, professional.id));
    expect(joao).toMatchObject({ phoneNumber: customer });
    const [visit] = await db.select().from(visits).where(eq(visits.customerId, joao!.id));
    expect(visit).toMatchObject({ status: 'scheduled' });

    const events = await drain(
      api.team({ id: schedulingAssistant.id }).messages.post({ text: 'Manda a confirmação pra ele.' }, { headers }),
    );

    expect(events.at(-1)).toEqual({ type: 'awaiting_confirmation' });
    expect(await listMessages({ phoneNumberId: from, waId: customer })).toEqual([]);
    const { data: paused } = await api.team({ id: schedulingAssistant.id }).messages.get({ headers });
    const card = paused!.items.find((item) => item.type === 'confirmation');
    expect(card).toMatchObject({ status: 'pending', subtitle: expect.stringContaining('João') });

    const resumed = await drain(
      api
        .team({ id: schedulingAssistant.id })
        .confirmations({ confirmationId: card!.id })
        .post({ confirmed: true }, { headers }),
    );

    expect(resumed.at(-1)).toEqual({ type: 'done' });
    const [sent] = await listMessages({ phoneNumberId: from, waId: customer });
    expect(sent).toMatchObject({ type: 'template', originType: 'visit', originId: visit!.id });
  }, 120_000);

  test('a free text Briefing answer fills the field of that step', async () => {
    const { headers, schedulingAssistant } = await schedulingAssistantForNewProfessional();

    const { data } = await api
      .team({ id: schedulingAssistant.id })
      .briefing.answers.post(
        { step: 'hours', text: 'de segunda a sexta das 7 às 17, sábado só de manhã até 11' },
        { headers },
      );

    expect(data).toEqual({ understood: true });
    const { data: briefing } = await api.team({ id: schedulingAssistant.id }).briefing.get({ headers });
    expect(briefing!.steps.find(({ key }) => key === 'hours')!.answer?.ack).toBeTruthy();
    const [stored] = await db
      .select({ playbook: assistants.playbook })
      .from(assistants)
      .where(eq(assistants.id, schedulingAssistant.id));
    expect(stored!.playbook).toEqual({
      hours: [
        { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '07:00', end: '17:00' },
        { days: ['sat'], start: expect.any(String), end: '11:00' },
      ],
    });
  }, 60_000);
});
