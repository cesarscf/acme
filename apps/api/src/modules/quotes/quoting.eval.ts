import { describe, expect, test } from 'bun:test';
import { called, customerOf, say, scriptedAssistant } from '../conversations/scripted-conversation';
import { upsertPriceItem } from './service';

// Real model, real tokens: run with `bun run evals`, never in `bun run test`.
async function quotesAssistantWithPrices() {
  const assistant = await scriptedAssistant('quotes');
  const cleaning = await upsertPriceItem(assistant.professional.id, { name: 'Limpeza de split', priceCents: 15000 });
  const installation = await upsertPriceItem(assistant.professional.id, {
    name: 'Instalação de split',
    priceCents: 45000,
  });
  return { assistant, cleaning, installation };
}

function itemsOf(call: { input: Record<string, unknown> } | undefined) {
  return (call?.input.items ?? []) as Record<string, unknown>[];
}

function quoteOf(turn: { calls: { name: string; input: Record<string, unknown> }[] }) {
  return turn.calls.find(({ name }) => name === 'createQuote');
}

describe('the quotes Assistant', () => {
  test('"faz um orçamento de limpeza de split pro João" quotes the PriceItem and sends it', async () => {
    const { assistant, cleaning } = await quotesAssistantWithPrices();
    const joao = await customerOf(assistant, 'João Pereira');

    const turn = await say(assistant, 'faz um orçamento de limpeza de split pro joão');

    expect(turn.calls).toContainEqual(called('listPriceItems'));
    expect(turn.calls).toContainEqual(called('createQuote', { customerId: joao.id }));
    expect(itemsOf(quoteOf(turn))).toEqual([expect.objectContaining({ priceItemId: cleaning.id, quantity: 1 })]);
    expect(turn.calls).toContainEqual(called('sendQuote'));
    expect(turn.end).toEqual({ type: 'awaiting_confirmation' });
  });

  test('a transcribed audio for a new Customer registers her and quotes two installations', async () => {
    const { assistant, installation } = await quotesAssistantWithPrices();

    const turn = await say(
      assistant,
      'então, preciso de um orçamento pra dona Cida Ramos, é cliente nova, instalação de dois split lá na casa dela, o número dela é 11 97654-3210',
    );

    expect(turn.calls).toContainEqual(called('createCustomer', { phoneNumber: expect.stringContaining('97654') }));
    expect(itemsOf(quoteOf(turn))).toEqual([expect.objectContaining({ priceItemId: installation.id, quantity: 2 })]);
  });

  test('a service missing from the price table makes it ask the price instead of inventing one', async () => {
    const { assistant } = await quotesAssistantWithPrices();
    await customerOf(assistant, 'João Pereira');

    const turn = await say(assistant, 'orçamento pro João de troca de compressor');

    expect(turn.calls).not.toContainEqual(called('createQuote'));
    expect(turn.calls).not.toContainEqual(called('upsertPriceItem'));
    expect(turn.reply).toMatch(/pre[çc]o|quanto|valor/i);
  });

  test('a price the Professional "always charges" is saved in the table and quoted', async () => {
    const { assistant } = await quotesAssistantWithPrices();
    await customerOf(assistant, 'João Pereira');

    const turn = await say(assistant, 'orçamento pro joão de troca de compressor, eu cobro sempre 1200 nisso');

    expect(turn.calls).toContainEqual(called('upsertPriceItem', { priceCents: 120000 }));
    const [item] = itemsOf(quoteOf(turn));
    expect(item).toBeDefined();
    // From the table it just saved, or as a one-off at the same price: either way the Customer sees R$ 1.200,00.
    expect(item!.priceItemId !== null || item!.unitPriceCents === 120000).toBe(true);
  });

  test('a discount for this Quote only changes this Quote, not the price table', async () => {
    const { assistant, cleaning } = await quotesAssistantWithPrices();
    await customerOf(assistant, 'João Pereira');

    const turn = await say(assistant, 'faz a limpeza de split do joão por 120 dessa vez, só pra ele');

    expect(itemsOf(quoteOf(turn))).toEqual([
      expect.objectContaining({ priceItemId: cleaning.id, unitPriceCents: 12000 }),
    ]);
    expect(turn.calls).not.toContainEqual(called('upsertPriceItem'));
  });

  test('two Customers with the same first name make it ask which one', async () => {
    const { assistant } = await quotesAssistantWithPrices();
    await customerOf(assistant, 'João Pereira');
    await customerOf(assistant, 'João Silva');

    const turn = await say(assistant, 'manda um orçamento de limpeza de split pro João');

    expect(turn.calls).toContainEqual(called('findCustomer'));
    expect(turn.calls).not.toContainEqual(called('createQuote'));
    expect(turn.reply).toMatch(/Pereira/);
    expect(turn.reply).toMatch(/Silva/);
  });
});
