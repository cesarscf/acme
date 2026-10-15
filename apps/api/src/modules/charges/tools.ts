import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import { formatMoney } from '../briefing/scripts';
import type { Assistant } from '../conversations/service';
import { type AssistantTool, confirmed, strict } from '../conversations/tools';
import { formatLocalDateTime } from '../visits/time';
import {
  type ChargeWithCustomer,
  chargeCard,
  confirmChargePaid,
  createCharge,
  findCharge,
  findPixAccount,
  listUnpaidWorkRecords,
  sendCharge,
} from './service';

const noPixAccount =
  'Falta a chave Pix, o nome ou a cidade na ficha. Peça ao profissional para combinar a função com você antes de cobrar.';

export function chargeTools({ professional }: Assistant): AssistantTool[] {
  async function ownCharge(chargeId: string) {
    const charge = await findCharge(professional.id, chargeId);
    if (!charge) throw new ToolError(`Cobrança ${chargeId} não encontrada. Use listCharges.`);
    return charge;
  }

  const toResult = ({ id, customer, service, status, amountCents, sentAt }: ChargeWithCustomer) => ({
    id,
    customer: { id: customer.id, name: customer.name },
    service,
    status,
    amount: formatMoney(amountCents),
    sent: !!sentAt,
  });

  return [
    {
      tool: strict(
        betaZodTool({
          name: 'listCharges',
          description:
            'Lista os serviços registrados que ainda não foram pagos, do mais novo ao mais antigo, com a cobrança no Pix de cada um quando já existe (status pending: enviada ou não, aguardando o cliente; awaiting_confirmation: o cliente tocou em Já paguei e falta o profissional conferir).',
          inputSchema: z.strictObject({}),
          run: async () => {
            const found = await listUnpaidWorkRecords(professional.id);
            if (!found.length) return 'Nenhum serviço a receber.';
            return JSON.stringify(
              found.map(({ workRecordId, createdAt, service, amountCents, customer, charge }) => ({
                workRecordId,
                when: formatLocalDateTime(createdAt, professional.timezone),
                customer,
                service,
                amount: formatMoney(amountCents!),
                charge: charge && { id: charge.id, status: charge.status, sent: !!charge.sentAt },
              })),
            );
          },
        }),
      ),
    },
    {
      tool: strict(
        betaZodTool({
          name: 'createCharge',
          description:
            'Monta a cobrança no Pix de um serviço registrado (workRecordId vem de listCharges), com o valor do serviço. Se o serviço já tem cobrança no Pix, devolve a mesma. A cobrança fica guardada; para mandar ao cliente, use sendCharge.',
          inputSchema: z.strictObject({ workRecordId: z.string().describe('id do serviço registrado.') }),
          run: async ({ workRecordId }) => {
            if (!(await findPixAccount(professional.id))) throw new ToolError(noPixAccount);
            const created = await createCharge(professional.id, workRecordId);
            if ('refused' in created) {
              if (created.refused === 'work_record_not_found')
                throw new ToolError(`Serviço ${workRecordId} não encontrado. Use listCharges.`);
              if (created.refused === 'work_record_incomplete')
                throw new ToolError(
                  'Esse serviço ainda não tem cliente ou valor. Peça ao profissional para completar na conversa do serviço.',
                );
              throw new ToolError('Esse serviço já foi pago.');
            }
            return `Cobrança montada, ainda não enviada: ${JSON.stringify(toResult(created.charge))}`;
          },
        }),
      ),
    },
    confirmed(
      betaZodTool({
        name: 'sendCharge',
        description:
          'Manda a cobrança ao cliente no WhatsApp, com o código Pix copia e cola (valor e identificador da cobrança) e o botão Já paguei. Também serve para mandar de novo. O profissional vê um cartão e só depois de ele tocar em Confirmar a mensagem sai. Quando o cliente tocar em Já paguei, aparece um <aviso> na conversa.',
        inputSchema: z.strictObject({ chargeId: z.string().describe('id da cobrança.') }),
        run: async ({ chargeId }) => {
          const charge = await ownCharge(chargeId);
          if (charge.status === 'paid' || charge.status === 'cancelled')
            throw new ToolError(`${charge.customer.name} já pagou essa cobrança.`);
          const account = await findPixAccount(professional.id);
          if (!account) throw new ToolError(noPixAccount);
          await sendCharge(charge, professional, account);
          return `Pix enviado para ${charge.customer.name} no WhatsApp.`;
        },
      }),
      async ({ chargeId }) => {
        const charge = await findCharge(professional.id, chargeId);
        if (!charge) {
          return { title: 'Para confirmar: cobrar no Pix', subtitle: '', rows: [], notices: [], question: 'Confirma?' };
        }
        return chargeCard({
          customerName: charge.customer.name,
          service: charge.service,
          amountCents: charge.amountCents,
        });
      },
    ),
    {
      tool: strict(
        betaZodTool({
          name: 'confirmChargePaid',
          description:
            'Registra o que o profissional viu no banco: received true quando o dinheiro caiu (Recebi), e a cobrança fica paga; false quando não caiu (Não caiu), e ela volta a aguardar o cliente. Use só com a palavra do profissional, nunca só porque o cliente tocou em Já paguei.',
          inputSchema: z.strictObject({
            chargeId: z.string().describe('id da cobrança.'),
            received: z.boolean().describe('true se o dinheiro caiu na conta, false se não caiu.'),
          }),
          run: async ({ chargeId, received }) => {
            const result = await confirmChargePaid(professional.id, chargeId, received);
            if ('refused' in result) {
              if (result.refused === 'not_found')
                throw new ToolError(`Cobrança ${chargeId} não encontrada. Use listCharges.`);
              throw new ToolError('Essa cobrança já estava paga.');
            }
            const { customer, amountCents } = result.charge;
            return received
              ? `Pago: ${formatMoney(amountCents)} de ${customer.name}.`
              : `Anotado: não caiu. A cobrança de ${customer.name} volta a aguardar o pagamento.`;
          },
        }),
      ),
    },
  ];
}
