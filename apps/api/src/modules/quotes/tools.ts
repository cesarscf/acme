import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import { formatMoney, quoteValidity } from '../briefing/scripts';
import type { Assistant } from '../conversations/service';
import { type AssistantTool, confirmed, strict } from '../conversations/tools';
import { findCustomer, formatPhoneNumber } from '../customers/service';
import { addDays, localDate } from '../visits/time';
import {
  createQuote,
  describeItem,
  findPriceItem,
  findQuote,
  formatDate,
  listPriceItems,
  type QuoteWithItems,
  sendQuote,
  upsertPriceItem,
} from './service';

// When the Playbook has no validity yet (not combined in the Briefing), the middle chip.
const defaultValidityDays = 15;

// Plain numbers: strict tools reject the bounds that z.int() adds to the schema.
const cents = z.number();

export function quoteTools({ professional, playbook }: Assistant): AssistantTool[] {
  const validity = quoteValidity.safeParse((playbook as Record<string, unknown>).quoteValidity);
  const validityDays = validity.data ?? defaultValidityDays;

  function wholeNumber(value: number, what: string) {
    if (!Number.isInteger(value) || value <= 0)
      throw new ToolError(`${what} inválido: ${value}. Use um inteiro maior que zero.`);
    return value;
  }

  async function ownQuote(quoteId: string) {
    const quote = await findQuote(professional.id, quoteId);
    if (!quote) throw new ToolError(`Orçamento ${quoteId} não encontrado.`);
    return quote;
  }

  const toResult = ({ id, customer, status, items, totalCents }: QuoteWithItems) => ({
    id,
    customer: { id: customer.id, name: customer.name },
    status,
    items: items.map(describeItem),
    total: formatMoney(totalCents),
  });

  return [
    {
      tool: strict(
        betaZodTool({
          name: 'listPriceItems',
          description: 'Lista a tabela de preços do profissional (os serviços e o preço de cada um).',
          inputSchema: z.strictObject({}),
          run: async () => {
            const found = await listPriceItems(professional.id);
            if (!found.length) return 'Nenhum serviço na tabela de preços ainda.';
            return JSON.stringify(
              found.map(({ id, name, priceCents }) => ({ id, name, priceCents, price: formatMoney(priceCents) })),
            );
          },
        }),
      ),
    },
    {
      tool: strict(
        betaZodTool({
          name: 'upsertPriceItem',
          description:
            'Salva um serviço na tabela de preços do profissional. Sem id, um serviço com o mesmo nome tem o preço atualizado; senão, é criado. Com id, muda o nome e o preço daquele serviço.',
          inputSchema: z.strictObject({
            priceItemId: z.string().nullable().describe('id do serviço para renomear, ou vazio.'),
            name: z.string().describe('Nome do serviço, como o profissional fala. Ex.: Limpeza de split.'),
            priceCents: cents.describe('Preço em centavos. Ex.: R$ 150,00 = 15000.'),
          }),
          run: async ({ priceItemId, name, priceCents }) => {
            if (!name.trim()) throw new ToolError('Falta o nome do serviço.');
            wholeNumber(priceCents, 'Preço');
            if (priceItemId && !(await findPriceItem(professional.id, priceItemId))) {
              throw new ToolError(`Serviço ${priceItemId} não encontrado. Use listPriceItems.`);
            }
            const priceItem = await upsertPriceItem(professional.id, {
              id: priceItemId ?? undefined,
              name: name.trim(),
              priceCents,
            });
            return `Serviço salvo: ${JSON.stringify({ id: priceItem.id, name: priceItem.name, price: formatMoney(priceItem.priceCents) })}`;
          },
        }),
      ),
    },
    {
      tool: strict(
        betaZodTool({
          name: 'createQuote',
          description:
            'Monta um orçamento para um cliente já cadastrado (use findCustomer ou createCustomer antes). Cada item vem da tabela de preços (priceItemId) ou é um serviço avulso com descrição e preço. O orçamento fica guardado; para mandar ao cliente, use sendQuote.',
          inputSchema: z.strictObject({
            customerId: z.string().describe('id do cliente.'),
            items: z
              .array(
                z.strictObject({
                  priceItemId: z
                    .string()
                    .nullable()
                    .describe('id do serviço na tabela de preços, ou vazio se for avulso.'),
                  description: z
                    .string()
                    .nullable()
                    .describe('Descrição do item avulso. Vazio usa o nome do serviço da tabela.'),
                  quantity: z.number().describe('Quantidade, inteira. Normalmente 1.'),
                  unitPriceCents: cents
                    .nullable()
                    .describe(
                      'Preço unitário em centavos, para item avulso ou se o profissional mudar o preço só neste orçamento. Vazio usa o da tabela.',
                    ),
                }),
              )
              .describe('Os itens do orçamento, pelo menos um.'),
          }),
          run: async ({ customerId, items }) => {
            const customer = await findCustomer(professional.id, customerId);
            if (!customer) throw new ToolError(`Cliente ${customerId} não encontrado. Use findCustomer.`);
            if (!items.length) throw new ToolError('O orçamento precisa de pelo menos um item.');
            const quoteItems = [];
            for (const item of items) {
              const priceItem = item.priceItemId ? await findPriceItem(professional.id, item.priceItemId) : undefined;
              if (item.priceItemId && !priceItem) {
                throw new ToolError(`Serviço ${item.priceItemId} não encontrado. Use listPriceItems.`);
              }
              const description = item.description?.trim() || priceItem?.name;
              const unitPriceCents = item.unitPriceCents ?? priceItem?.priceCents;
              if (!description) throw new ToolError('Item avulso sem descrição.');
              if (unitPriceCents === undefined) {
                throw new ToolError(`Falta o preço de "${description}". Pergunte ao profissional.`);
              }
              quoteItems.push({
                priceItemId: priceItem?.id ?? null,
                description,
                quantity: wholeNumber(item.quantity, 'Quantidade'),
                unitPriceCents: wholeNumber(unitPriceCents, 'Preço'),
              });
            }
            const quote = (await findQuote(
              professional.id,
              await createQuote(professional.id, customer.id, quoteItems),
            ))!;
            return `Orçamento montado, ainda não enviado: ${JSON.stringify(toResult(quote))}`;
          },
        }),
      ),
    },
    confirmed(
      betaZodTool({
        name: 'sendQuote',
        description: `Manda o orçamento ao cliente, no WhatsApp, com os botões Aprovar e Recusar e validade de ${validityDays} dias. Também serve para mandar de novo um orçamento sem resposta. O profissional vê um cartão e só depois de ele tocar em Confirmar a mensagem sai. Quando o cliente tocar num botão, aparece um <aviso> na conversa.`,
        inputSchema: z.strictObject({ quoteId: z.string().describe('id do orçamento.') }),
        run: async ({ quoteId }) => {
          const quote = await ownQuote(quoteId);
          if (quote.status === 'approved' || quote.status === 'declined') {
            throw new ToolError(`${quote.customer.name} já respondeu esse orçamento. Monte um novo se precisar.`);
          }
          const validUntil = await sendQuote(quote, professional, validityDays);
          return `Orçamento enviado para ${quote.customer.name} no WhatsApp, válido até ${formatDate(validUntil)}.`;
        },
      }),
      async ({ quoteId }) => {
        const quote = await findQuote(professional.id, quoteId);
        const name = quote?.customer.name ?? 'o cliente';
        const validUntil = addDays(localDate(new Date(), professional.timezone), validityDays);
        return {
          title: `Para confirmar: mandar o orçamento para ${name}`,
          subtitle: name,
          rows: quote
            ? [
                { label: 'Cliente', value: quote.customer.name },
                { label: 'WhatsApp', value: formatPhoneNumber(quote.customer.phoneNumber) },
                ...quote.items.map(({ description, quantity, unitPriceCents }) => ({
                  label: quantity === 1 ? description : `${quantity}x ${description}`,
                  value: formatMoney(quantity * unitPriceCents),
                })),
                { label: 'Total', value: formatMoney(quote.totalCents) },
                { label: 'Validade', value: `${validityDays} dias, até ${formatDate(validUntil)}` },
              ]
            : [],
          notices: [
            'Nada é enviado agora.',
            `Depois que você confirmar, ${name} recebe o orçamento no WhatsApp com os botões Aprovar e Recusar.`,
          ],
          question: `Confirma: mandar o orçamento para ${name}?`,
        };
      },
    ),
  ];
}
