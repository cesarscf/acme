import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod';
import { claude, modelParams, recordUsage } from '../conversations/service';
import type { PaymentMethod, PaymentMethods } from './service';

export type WorkRecordDraft = {
  customerId: string | null;
  visitId: string | null;
  description: string | null;
  materials: string | null;
  amountCents: number | null;
  paymentMethod: PaymentMethod;
};

type Context = {
  professionalId: string;
  assistantId: string | null;
  customers: { id: string; name: string }[];
  visits: { id: string; customerId: string; customerName: string; when: string }[];
  paymentMethods: PaymentMethods;
};

const paymentMethodNames: Record<PaymentMethod, string> = { pix: 'Pix', cash: 'dinheiro' };

const system = `Você preenche o formulário de um serviço que um profissional acabou de fazer na casa ou na empresa de um cliente. Ele contou o serviço num áudio, que foi transcrito. O profissional confere tudo antes de salvar, então deixe em branco (null) o que ele não disse em vez de inventar.

- customer: a referência (C1, C2…) do cliente que ele citou. Se o nome bate com mais de um cliente, prefira o que tem visita recente. Se não está na lista, null.
- visit: a referência (V1, V2…) da visita recente desse cliente que mais combina com o relato (em geral a mais recente). Se não houver, null.
- description: o que foi feito, numa frase curta e clara, sem o nome do cliente, o material ou o valor (ex.: "Troca do capacitor do ar-condicionado").
- materials: o material usado, como ele disse (ex.: "2 metros de cobre"), ou null.
- amountCents: o valor cobrado do cliente, em centavos (350 reais = 35000), ou null.
- paymentMethod: como o cliente paga, entre as formas aceitas; null se ele não disse ou se disse uma forma que não está na lista.`;

const schema = z.strictObject({
  customer: z.string().nullable(),
  visit: z.string().nullable(),
  description: z.string().nullable(),
  materials: z.string().nullable(),
  // Not z.int(): its bounds break the strict JSON schema; the value is checked below.
  amountCents: z.number().nullable(),
  paymentMethod: z.enum(['pix', 'cash']).nullable(),
});

// Claude only proposes: every field comes back to the Professional's form, and the references it picks are checked.
export async function draftWorkRecord(context: Context, transcript: string): Promise<WorkRecordDraft> {
  const empty: WorkRecordDraft = {
    customerId: null,
    visitId: null,
    description: null,
    materials: null,
    amountCents: null,
    paymentMethod: context.paymentMethods.default,
  };
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
  if (message.stop_reason !== 'end_turn' || !output) return empty;
  let parsed: z.infer<typeof schema>;
  try {
    parsed = format.parse(output);
  } catch (error) {
    if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError) return empty;
    throw error;
  }

  const visit = parsed.visit ? visitRefs.get(parsed.visit) : undefined;
  const customerId = (parsed.customer && customerRefs.get(parsed.customer)?.id) || visit?.customerId || null;
  const amount = parsed.amountCents === null ? null : Math.round(parsed.amountCents);
  return {
    customerId,
    visitId: visit && visit.customerId === customerId ? visit.id : null,
    description: parsed.description?.trim() || null,
    materials: parsed.materials?.trim() || null,
    amountCents: amount && amount > 0 ? amount : null,
    paymentMethod:
      parsed.paymentMethod && context.paymentMethods.accepted.includes(parsed.paymentMethod)
        ? parsed.paymentMethod
        : context.paymentMethods.default,
  };
}
