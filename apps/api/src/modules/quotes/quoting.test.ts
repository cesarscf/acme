import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt, randomUUID } from 'node:crypto';
import { db, quotes } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import type Anthropic from '@anthropic-ai/sdk';
import { treaty } from '@elysia/eden';
import { eq } from 'drizzle-orm';
import { app } from '../../app';
import { signInNewProfessional } from '../auth/test-auth';
import { startFakeClaude } from '../conversations/fake-claude';
import { findAssistant } from '../conversations/service';
import { runTool } from '../conversations/test-tools';
import { customerTools } from '../customers/tools';
import { listMessages } from '../whatsapp/service';
import { ensureQuoteTemplates } from './service';
import { quoteTools } from './tools';

const api = treaty(app);
const claude = startFakeClaude();
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
  await ensureQuoteTemplates();
});

afterAll(async () => {
  claude.stop();
  await emulator.stop();
  await app.stop();
});

async function professionalWithQuotesAssistant() {
  const signedIn = await signInNewProfessional();
  await api.me['ai-consent'].post(undefined, { headers: signedIn.headers });
  await api.team.post({ roles: ['quotes'] }, { headers: signedIn.headers });
  const { data: team } = await api.team.get({ headers: signedIn.headers });
  const quotesAssistant = (await findAssistant(signedIn.professional.id, team![0]!.id))!;
  const created = await runTool(customerTools(quotesAssistant), 'createCustomer', {
    name: 'João Pereira',
    phoneNumber: `55119${String(randomInt(1e8)).padStart(8, '0')}`,
  });
  const joao = JSON.parse(created.text.slice(created.text.indexOf('{'))) as { id: string; phoneNumber: string };
  await runTool(quoteTools(quotesAssistant), 'upsertPriceItem', {
    priceItemId: null,
    name: 'Limpeza de split',
    priceCents: 18000,
  });
  return { headers: signedIn.headers, quotesAssistant, joao, conversation: api.team({ id: quotesAssistant.id }) };
}

async function drain<T>(request: Promise<{ data: AsyncIterable<{ data: T }> | null; error: unknown }>) {
  const { data, error } = await request;
  expect(error).toBeNull();
  const events: T[] = [];
  for await (const event of data!) events.push(event.data);
  return events;
}

function call(name: string, input: Record<string, unknown>) {
  return { type: 'tool_use' as const, id: `toolu_${randomUUID()}`, name, input };
}

function say(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function lastToolResult(request: Anthropic.Beta.MessageCreateParams) {
  const content = request.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
  return String(content.findLast((block) => block.type === 'tool_result')!.content);
}

function idIn(result: string) {
  return (JSON.parse(result.slice(result.indexOf('{'))) as { id: string }).id;
}

type ProfessionalWithQuotesAssistant = Awaited<ReturnType<typeof professionalWithQuotesAssistant>>;

async function askForSplitCleaning({ headers, joao, conversation }: ProfessionalWithQuotesAssistant) {
  let priceList = '';
  claude.reply(
    { content: [call('listPriceItems', {}), call('findCustomer', { query: 'João' })] },
    (request) => {
      priceList = String((request.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0]!.content);
      const [cleaning] = JSON.parse(priceList) as { id: string }[];
      return {
        content: [
          call('createQuote', {
            customerId: joao.id,
            items: [{ priceItemId: cleaning!.id, description: null, quantity: 1, unitPriceCents: null }],
          }),
        ],
      };
    },
    (request) => ({ content: [call('sendQuote', { quoteId: idIn(lastToolResult(request)) })] }),
  );
  const events = await drain(
    conversation.messages.post({ text: 'Orçamento de limpeza de split pro João' }, { headers }),
  );
  expect(events.at(-1)).toEqual({ type: 'awaiting_confirmation' });
  expect(priceList).toContain('Limpeza de split');
  const { data } = await conversation.messages.get({ headers });
  return data!.items.at(-1)!;
}

async function sendSplitCleaning(quotesAssistant: ProfessionalWithQuotesAssistant) {
  const card = await askForSplitCleaning(quotesAssistant);
  claude.reply(say('Mandei. Te aviso quando ele responder.'));
  await drain(
    quotesAssistant.conversation
      .confirmations({ confirmationId: card.id })
      .post({ confirmed: true }, { headers: quotesAssistant.headers }),
  );
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: quotesAssistant.joao.phoneNumber });
  const [quote] = await db.select().from(quotes).where(eq(quotes.customerId, quotesAssistant.joao.id));
  return { sent: sent!, quote: quote! };
}

test('"Orçamento de limpeza de split pro João" builds the Quote from the PriceItems and shows the confirmation card', async () => {
  const quotesAssistant = await professionalWithQuotesAssistant();

  const card = await askForSplitCleaning(quotesAssistant);

  expect(card).toMatchObject({
    type: 'confirmation',
    status: 'pending',
    title: 'Para confirmar: mandar o orçamento para João Pereira',
    rows: expect.arrayContaining([
      { label: 'Limpeza de split', value: expect.stringMatching(/R\$\s180,00/) },
      { label: 'Total', value: expect.stringMatching(/R\$\s180,00/) },
      { label: 'Validade', value: expect.stringContaining('15 dias') },
    ]),
  });
  const [quote] = await db.select().from(quotes).where(eq(quotes.customerId, quotesAssistant.joao.id));
  expect(quote).toMatchObject({ status: 'draft', totalCents: 18000 });
  expect(await listMessages({ phoneNumberId: platformNumber, waId: quotesAssistant.joao.phoneNumber })).toEqual([]);
});

test("Aprovar on the Customer side marks the Quote approved and tells the Professional in the quotes Assistant's conversation", async () => {
  const quotesAssistant = await professionalWithQuotesAssistant();
  const { sent, quote } = await sendSplitCleaning(quotesAssistant);
  expect(sent).toMatchObject({ type: 'template', originType: 'quote', originId: quote.id });

  const click = await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  expect(click.data?.webhook?.status).toBe(200);
  const [approved] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
  expect(approved!.status).toBe('approved');
  const { data } = await quotesAssistant.conversation.messages.get({ headers: quotesAssistant.headers });
  expect(data!.items.at(-1)).toMatchObject({
    type: 'notice',
    text: expect.stringMatching(/^João Pereira aprovou o orçamento de R\$\s180,00\.$/),
  });
  claude.reply(say('Boa!'));

  await drain(quotesAssistant.conversation.messages.post({ text: 'Valeu' }, { headers: quotesAssistant.headers }));

  expect(claude.requests.at(-1)!.messages.at(-1)).toEqual({
    role: 'user',
    content: [
      { type: 'text', text: expect.stringMatching(/^<aviso>João Pereira aprovou .+<\/aviso>$/) },
      { type: 'text', text: 'Valeu' },
    ],
  });
});

test('Recusar marks the Quote declined, and a later tap changes nothing', async () => {
  const quotesAssistant = await professionalWithQuotesAssistant();
  const { sent, quote } = await sendSplitCleaning(quotesAssistant);

  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 1 });
  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const [row] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
  expect(row!.status).toBe('declined');
  const { data } = await quotesAssistant.conversation.messages.get({ headers: quotesAssistant.headers });
  expect(data!.items.slice(-2)).toMatchObject([
    { type: 'notice', text: expect.stringContaining('João Pereira recusou o orçamento') },
    { type: 'notice', text: expect.stringContaining('já estava recusado') },
  ]);
});

test('Aprovar after the validity changes nothing and says the Quote expired', async () => {
  const quotesAssistant = await professionalWithQuotesAssistant();
  const { sent, quote } = await sendSplitCleaning(quotesAssistant);
  await db.update(quotes).set({ validUntil: '2020-01-31' }).where(eq(quotes.id, quote.id));

  await meta.emulator.messages({ id: sent.wamid }).click.post({ index: 0 });

  const [row] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
  expect(row!.status).toBe('sent');
  const { data } = await quotesAssistant.conversation.messages.get({ headers: quotesAssistant.headers });
  expect(data!.items.at(-1)).toMatchObject({ type: 'notice', text: expect.stringContaining('venceu em 31/01') });
});
