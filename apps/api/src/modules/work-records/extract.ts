import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod';
import { claude, modelParams, recordUsage } from '../conversations/service';
import type { PaymentMethod, PaymentMethods } from './service';

// Null is "the Professional did not say it": the WorkRecord keeps what it had.
export type Extraction = {
  customerId: string | null;
  visitId: string | null;
  title: string | null;
  description: string | null;
  materials: string | null;
  amountCents: number | null;
  paymentMethod: PaymentMethod | null;
  cashReceived: boolean | null;
};

type Context = {
  professionalId: string;
  assistantId: string | null;
  customers: { id: string; name: string }[];
  visits: { id: string; customerId: string; customerName: string; when: string }[];
  paymentMethods: PaymentMethods;
};

const paymentMethodNames: Record<PaymentMethod, string> = { pix: 'Pix', cash: 'dinheiro' };

const system = `Você registra um serviço que um profissional acabou de fazer na casa ou na empresa de um cliente. Ele contou o serviço num áudio, que foi transcrito, e às vezes completou por mensagem depois. O registro é salvo direto, sem formulário: deixe em branco (null) o que ele não disse em vez de inventar. Se ele corrigiu algo numa mensagem, vale a correção.

- customer: a referência (C1, C2…) do cliente que ele citou. Se o nome bate com mais de um cliente, prefira o que tem visita recente. Se não está na lista, null.
- visit: a referência (V1, V2…) da visita recente desse cliente que mais combina com o relato (em geral a mais recente). Se não houver, null.
- title: o nome curto do serviço, em 2 a 4 palavras (ex.: "Limpeza de split").
- description: o que foi feito, numa frase clara, sem o nome do cliente, o material ou o valor (ex.: "Limpeza completa de split 12.000 BTU e troca de capacitor").
- materials: o material usado, como ele disse, separado por " · " (ex.: "1 capacitor 35 µF · 2 m de fita"), ou null.
- amountCents: o valor cobrado do cliente, em centavos (350 reais = 35000), ou null.
- paymentMethod: como o cliente paga, entre as formas aceitas; null se ele não disse ou se disse uma forma que não está na lista.
- cashReceived: true se ele disse que já recebeu em dinheiro, false se disse que ainda vai receber, null se não disse.`;

const schema = z.strictObject({
  customer: z.string().nullable(),
  visit: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  materials: z.string().nullable(),
  // Not z.int(): its bounds break the strict JSON schema; the value is checked below.
  amountCents: z.number().nullable(),
  paymentMethod: z.enum(['pix', 'cash']).nullable(),
  cashReceived: z.boolean().nullable(),
});

const nothing: Extraction = {
  customerId: null,
  visitId: null,
  title: null,
  description: null,
  materials: null,
  amountCents: null,
  paymentMethod: null,
  cashReceived: null,
};

// Claude picks Customers and Visits by short references, and the API keeps only the ones that exist.
export async function extractWorkRecord(context: Context, transcript: string): Promise<Extraction> {
  const customerRefs = new Map(context.customers.map((customer, index) => [`C${index + 1}`, customer]));
  const visitRefs = new Map(context.visits.map((visit, index) => [`V${index + 1}`, visit]));
  const customerList = [...customerRefs].map(([ref, { name }]) => `- ${ref}: ${name}`).join('\n') || '(nenhum)';
  const visitList =
    [...visitRefs].map(([ref, visit]) => `- ${ref}: ${visit.customerName}, ${visit.when}`).join('\n') || '(nenhuma)';
  const accepted = context.paymentMethods.accepted.map((method) => `${method} (${paymentMethodNames[method]})`);

  const format = betaZodOutputFormat(schema);
  const message = await claude().beta.messages.create({
    ...modelParams(),
    max_tokens: 2000,
    output_config: { effort: 'low', format },
    system,
    messages: [
      {
        role: 'user',
        content: `Clientes:\n${customerList}\n\nVisitas recentes:\n${visitList}\n\nFormas aceitas: ${accepted.join(', ')}\n\n<relato>${transcript}</relato>`,
      },
    ],
  });
  // create, not parse: parse throws on an output outside the schema before the usage can be recorded.
  await recordUsage({ id: context.assistantId, professional: { id: context.professionalId } }, message);

  const output = message.content.find((block) => block.type === 'text')?.text;
  if (message.stop_reason !== 'end_turn' || !output) return nothing;
  let parsed: z.infer<typeof schema>;
  try {
    parsed = format.parse(output);
  } catch (error) {
    if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError) return nothing;
    throw error;
  }

  const visit = parsed.visit ? visitRefs.get(parsed.visit) : undefined;
  const customerId = (parsed.customer && customerRefs.get(parsed.customer)?.id) || visit?.customerId || null;
  const amount = parsed.amountCents === null ? null : Math.round(parsed.amountCents);
  return {
    customerId,
    visitId: visit && visit.customerId === customerId ? visit.id : null,
    title: parsed.title?.trim() || null,
    description: parsed.description?.trim() || null,
    materials: parsed.materials?.trim() || null,
    amountCents: amount && amount > 0 && amount <= 100_000_000 ? amount : null,
    paymentMethod:
      parsed.paymentMethod && context.paymentMethods.accepted.includes(parsed.paymentMethod)
        ? parsed.paymentMethod
        : null,
    cashReceived: parsed.cashReceived,
  };
}
