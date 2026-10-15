import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomInt } from 'node:crypto';
import { assistants, db, priceItems, quoteItems, quotes } from '@acme/db';
import { createApp as createEmulator } from '@acme/meta-emulator/app';
import { treaty } from '@elysia/eden';
import { asc, eq } from 'drizzle-orm';
import { type Assistant, findAssistant } from '../conversations/service';
import { newAssistant, runTool } from '../conversations/test-tools';
import { customerTools } from '../customers/tools';
import { localDate } from '../visits/time';
import { listMessages } from '../whatsapp/service';
import { ensureQuoteTemplates } from './service';
import { quoteTools } from './tools';

const emulator = createEmulator({
  appSecret: process.env.META_APP_SECRET!,
  verifyToken: process.env.META_VERIFY_TOKEN!,
  webhookUrl: 'http://localhost:1/webhooks/whatsapp',
}).listen(0);
const meta = treaty(emulator, { headers: { authorization: 'Bearer token' } });
const platformNumber = process.env.META_PLATFORM_PHONE_NUMBER_ID!;

beforeAll(async () => {
  process.env.META_GRAPH_URL = `http://localhost:${emulator.server!.port}`;
  await ensureQuoteTemplates();
});

afterAll(async () => {
  await emulator.stop();
});

function newPhoneNumber() {
  return `55119${String(randomInt(1e8)).padStart(8, '0')}`;
}

async function newCustomer(quotesAssistant: Assistant, name = 'João Pereira') {
  const { text } = await runTool(customerTools(quotesAssistant), 'createCustomer', {
    name,
    phoneNumber: newPhoneNumber(),
  });
  return JSON.parse(text.slice(text.indexOf('{'))) as { id: string; name: string; phoneNumber: string };
}

async function upsert(quotesAssistant: Assistant, name: string, priceCents: number, priceItemId: string | null = null) {
  return runTool(quoteTools(quotesAssistant), 'upsertPriceItem', { priceItemId, name, priceCents });
}

async function priceItemsOf(quotesAssistant: Assistant) {
  return db
    .select()
    .from(priceItems)
    .where(eq(priceItems.professionalId, quotesAssistant.professional.id))
    .orderBy(asc(priceItems.name));
}

type ItemInput = {
  priceItemId?: string | null;
  description?: string | null;
  quantity?: number;
  unitPriceCents?: number | null;
};

function createQuote(quotesAssistant: Assistant, customerId: string, items: ItemInput[]) {
  return runTool(quoteTools(quotesAssistant), 'createQuote', {
    customerId,
    items: items.map((item) => ({
      priceItemId: null,
      description: null,
      quantity: 1,
      unitPriceCents: null,
      ...item,
    })),
  });
}

async function quotesOf(quotesAssistant: Assistant) {
  return db.select().from(quotes).where(eq(quotes.professionalId, quotesAssistant.professional.id));
}

async function quotesAssistantWithSplitCleaning() {
  const quotesAssistant = await newAssistant('quotes');
  const joao = await newCustomer(quotesAssistant);
  await upsert(quotesAssistant, 'Limpeza de split', 18000);
  const [cleaning] = await priceItemsOf(quotesAssistant);
  return { quotesAssistant, joao, cleaning: cleaning! };
}

test('upsertPriceItem adds a PriceItem, and the same name again only changes its price', async () => {
  const quotesAssistant = await newAssistant('quotes');

  const added = await upsert(quotesAssistant, 'Limpeza de split', 15000);
  const changed = await upsert(quotesAssistant, 'limpeza de split ', 18000);

  expect(added.isError).toBe(false);
  expect(changed.isError).toBe(false);
  expect(await priceItemsOf(quotesAssistant)).toEqual([
    expect.objectContaining({ name: 'Limpeza de split', priceCents: 18000 }),
  ]);
});

test('upsertPriceItem with an id renames and reprices that PriceItem, only if it is the Professional’s', async () => {
  const quotesAssistant = await newAssistant('quotes');
  const intruder = await newAssistant('quotes');
  await upsert(quotesAssistant, 'Limpeza', 15000);
  const [item] = await priceItemsOf(quotesAssistant);

  const foreign = await upsert(intruder, 'Roubado', 1, item!.id);
  const own = await upsert(quotesAssistant, 'Limpeza de split', 16000, item!.id);

  expect(foreign.isError).toBe(true);
  expect(own.isError).toBe(false);
  expect(await priceItemsOf(quotesAssistant)).toEqual([
    expect.objectContaining({ id: item!.id, name: 'Limpeza de split', priceCents: 16000 }),
  ]);
});

test('upsertPriceItem refuses a price that is not a positive whole number of cents', async () => {
  const quotesAssistant = await newAssistant('quotes');

  const fractional = await upsert(quotesAssistant, 'Limpeza', 150.5);
  const zero = await upsert(quotesAssistant, 'Limpeza', 0);

  expect(fractional.isError).toBe(true);
  expect(zero.isError).toBe(true);
  expect(await priceItemsOf(quotesAssistant)).toEqual([]);
});

test('listPriceItems shows the price list, or says it is empty', async () => {
  const quotesAssistant = await newAssistant('quotes');
  const empty = await runTool(quoteTools(quotesAssistant), 'listPriceItems', {});
  await upsert(quotesAssistant, 'Limpeza de split', 18000);
  await upsert(quotesAssistant, 'Instalação de split', 45000);

  const { text } = await runTool(quoteTools(quotesAssistant), 'listPriceItems', {});

  expect(empty.text).toContain('Nenhum');
  const listed = JSON.parse(text) as { name: string; priceCents: number }[];
  expect(listed.map(({ name, priceCents }) => [name, priceCents])).toEqual([
    ['Instalação de split', 45000],
    ['Limpeza de split', 18000],
  ]);
});

test('createQuote builds a draft Quote from PriceItems and items priced on the spot, with the total', async () => {
  const { quotesAssistant, joao, cleaning } = await quotesAssistantWithSplitCleaning();

  const { text, isError } = await createQuote(quotesAssistant, joao.id, [
    { priceItemId: cleaning.id, quantity: 2 },
    { description: 'Troca de capacitor', unitPriceCents: 12000 },
  ]);

  expect(isError).toBe(false);
  expect(text).toContain('João Pereira');
  const [quote] = await quotesOf(quotesAssistant);
  expect(quote).toMatchObject({ customerId: joao.id, status: 'draft', totalCents: 48000, sentAt: null });
  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quote!.id))
    .orderBy(quoteItems.position);
  expect(items).toEqual([
    expect.objectContaining({
      priceItemId: cleaning.id,
      description: 'Limpeza de split',
      quantity: 2,
      unitPriceCents: 18000,
    }),
    expect.objectContaining({
      priceItemId: null,
      description: 'Troca de capacitor',
      quantity: 1,
      unitPriceCents: 12000,
    }),
  ]);
});

test('createQuote refuses no items, an item without a price, and another Professional’s Customer or PriceItem', async () => {
  const { quotesAssistant, joao, cleaning } = await quotesAssistantWithSplitCleaning();
  const intruder = await newAssistant('quotes');
  const someoneElse = await newCustomer(intruder);

  const results = await Promise.all([
    createQuote(quotesAssistant, joao.id, []),
    createQuote(quotesAssistant, joao.id, [{ description: 'Troca de capacitor' }]),
    createQuote(quotesAssistant, joao.id, [{ priceItemId: cleaning.id, quantity: 0 }]),
    createQuote(quotesAssistant, someoneElse.id, [{ priceItemId: cleaning.id }]),
    createQuote(intruder, someoneElse.id, [{ priceItemId: cleaning.id }]),
  ]);

  expect(results.map(({ isError }) => isError)).toEqual([true, true, true, true, true]);
  expect(await quotesOf(quotesAssistant)).toEqual([]);
  expect(await quotesOf(intruder)).toEqual([]);
});

async function draftQuote() {
  const setup = await quotesAssistantWithSplitCleaning();
  await createQuote(setup.quotesAssistant, setup.joao.id, [{ priceItemId: setup.cleaning.id, quantity: 2 }]);
  const [quote] = await quotesOf(setup.quotesAssistant);
  return { ...setup, quote: quote! };
}

test('sendQuote sends the Quote with Aprovar and Recusar, valid for the days in the Playbook', async () => {
  const { quotesAssistant: draft, joao, quote } = await draftQuote();
  await db
    .update(assistants)
    .set({ playbook: { quoteValidity: 7 } })
    .where(eq(assistants.id, draft.id));
  const quotesAssistant = (await findAssistant(draft.professional.id, draft.id))!;

  const { text, isError } = await runTool(quoteTools(quotesAssistant), 'sendQuote', { quoteId: quote.id });

  expect(isError).toBe(false);
  expect(text).toContain('João Pereira');
  const [sent] = await listMessages({ phoneNumberId: platformNumber, waId: joao.phoneNumber });
  expect(sent).toMatchObject({ type: 'template', originType: 'quote', originId: quote.id });
  const { data: shown } = await meta.emulator.messages.get();
  const message = shown!.find(({ id }) => id === sent!.wamid)!;
  expect(message.buttons.map((button) => button.text)).toEqual(['Aprovar', 'Recusar']);
  expect(message.body).toContain('2x Limpeza de split');
  expect(message.body).toMatch(/R\$\s360,00/);
  const [row] = await quotesOf(quotesAssistant);
  const validUntil = localDate(new Date(Date.now() + 7 * 86_400_000), 'America/Sao_Paulo');
  expect(row).toMatchObject({ status: 'sent', validUntil, followedUpAt: null });
  expect(row!.sentAt).toBeInstanceOf(Date);
});

test('sendQuote refuses a Quote the Customer already answered', async () => {
  const { quotesAssistant, quote } = await draftQuote();
  await db.update(quotes).set({ status: 'approved' }).where(eq(quotes.id, quote.id));

  const { isError } = await runTool(quoteTools(quotesAssistant), 'sendQuote', { quoteId: quote.id });

  expect(isError).toBe(true);
});
