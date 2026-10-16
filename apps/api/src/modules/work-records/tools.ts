import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import { formatMoney } from '../briefing/scripts';
import type { Assistant } from '../conversations/service';
import { type AssistantTool, strict } from '../conversations/tools';
import { addMessage } from './service';

// The billing Assistant completes a WorkRecord from what the Professional says in the Customer's thread.
export function workRecordTools({ professional }: Assistant): AssistantTool[] {
  return [
    {
      status: 'Corrigindo o registro',
      tool: strict(
        betaZodTool({
          name: 'updateWorkRecord',
          description:
            'Completa ou corrige um serviço registrado (ou uma visita registrada, sem valor) com o que o profissional disse: o valor, a forma de pagamento (Pix ou dinheiro, e se já recebeu), o que foi feito, o material. O registro é relido inteiro com a correção; o cliente não muda. Use quando ele contar o valor de uma visita registrada ou corrigir um registro.',
          inputSchema: z.strictObject({
            workRecordId: z.string().describe('id do registro, do histórico ou de listCharges.'),
            correction: z
              .string()
              .describe('O que o profissional disse, com as palavras dele. Ex.: "Ficou 350 no Pix".'),
          }),
          run: async ({ workRecordId, correction }) => {
            const updated = await addMessage(professional.id, workRecordId, correction);
            if (!updated) throw new ToolError(`Registro ${workRecordId} não encontrado.`);
            const { title, description, amountCents, paymentMethod, paid } = updated;
            return `Registro atualizado: ${JSON.stringify({
              title,
              description,
              amount: amountCents && formatMoney(amountCents),
              paymentMethod,
              paid,
            })}`;
          },
        }),
      ),
    },
  ];
}
