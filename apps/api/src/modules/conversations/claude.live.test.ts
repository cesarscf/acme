import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { db, llmUsages } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { listMessages } from '../whatsapp/service';

// Calls the real Claude API and spends tokens, so it runs only with `bun run test:claude`.
describe.skipIf(!process.env.CLAUDE_LIVE)('the Assistant on the real Claude API', () => {
  const api = treaty(app);
  const emulator = createEmulator({
    appSecret: process.env.META_APP_SECRET!,
    verifyToken: process.env.META_VERIFY_TOKEN!,
    webhookUrl: 'http://localhost:0/webhooks/whatsapp',
  });

  beforeAll(() => {
    emulator.listen(0);
    process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  });

  afterAll(() => emulator.stop());

  async function liaForNewProfessional() {
    const signedIn = await signInNewProfessional();
    await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
    await api.team.post({ roles: ['scheduling'] }, { headers: signedIn.headers });
    const { data: team } = await api.team.get({ headers: signedIn.headers });
    return { ...signedIn, lia: team![0]! };
  }

  async function drain<T>(request: Promise<{ data: AsyncIterable<{ data: T }> | null; error: unknown }>) {
    const { data, error } = await request;
    expect(error).toBeNull();
    const events: T[] = [];
    for await (const event of data!) events.push(event.data);
    return events;
  }

  test('Lia answers in Portuguese and the tokens are recorded', async () => {
    const { professional, headers, lia } = await liaForNewProfessional();

    const events = await drain(api.team({ id: lia.id }).messages.post({ text: 'Oi! Qual é o seu nome?' }, { headers }));

    expect(events.at(-1)).toEqual({ type: 'done' });
    const { data } = await api.team({ id: lia.id }).messages.get({ headers });
    const reply = data!.items.at(-1)!;
    expect(reply.type).toBe('assistant');
    expect(reply.type === 'assistant' && reply.text).toContain('Lia');
    const [usage] = await db.select().from(llmUsages).where(eq(llmUsages.professionalId, professional.id));
    expect(usage).toMatchObject({ assistantId: lia.id, model: expect.stringContaining('claude-haiku-5-5') });
    expect(usage!.inputTokens).toBeGreaterThan(0);
    expect(usage!.outputTokens).toBeGreaterThan(0);
  }, 60_000);

  test('a message to a Customer waits for Confirmar, then goes out on WhatsApp', async () => {
    const { headers, lia } = await liaForNewProfessional();
    const customer = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
    const from = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

    const events = await drain(
      api
        .team({ id: lia.id })
        .messages.post(
          { text: `Manda uma mensagem pro João Pereira no WhatsApp ${customer} dizendo que chego às 14h.` },
          { headers },
        ),
    );

    expect(events.at(-1)).toEqual({ type: 'awaiting_confirmation' });
    expect(await listMessages({ phoneNumberId: from, waId: customer })).toEqual([]);
    const { data: paused } = await api.team({ id: lia.id }).messages.get({ headers });
    const card = paused!.items.find((item) => item.type === 'confirmation');
    expect(card).toMatchObject({ status: 'pending', subtitle: expect.stringContaining('João') });

    const resumed = await drain(
      api.team({ id: lia.id }).confirmations({ confirmationId: card!.id }).post({ confirmed: true }, { headers }),
    );

    expect(resumed.at(-1)).toEqual({ type: 'done' });
    const [sent] = await listMessages({ phoneNumberId: from, waId: customer });
    expect(sent?.text).toContain('14');
  }, 90_000);
});
