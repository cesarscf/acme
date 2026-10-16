import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import type { Assistant } from '../conversations/service';
import { type AssistantTool, strict } from '../conversations/tools';
import { catalogEntry } from '../team/catalog';
import { type Customer, createCustomer, findCustomers, toPhoneNumber } from './service';

export function customerTools({ professional }: Assistant): AssistantTool[] {
  return [
    {
      status: 'Procurando o cliente',
      tool: strict(
        betaZodTool({
          name: 'findCustomer',
          description:
            'Procura os clientes do profissional por parte do nome ou do WhatsApp. Use antes de criar um cliente ou de marcar algo para ele.',
          inputSchema: z.strictObject({
            query: z.string().describe('Parte do nome (ex.: João) ou do número do cliente.'),
          }),
          run: async ({ query }) => {
            const found = await findCustomers(professional.id, query);
            if (!found.length) return `Nenhum cliente encontrado para "${query}".`;
            return JSON.stringify(found.map(toResult));
          },
        }),
      ),
    },
    {
      status: 'Cadastrando o cliente',
      tool: strict(
        betaZodTool({
          name: 'createCustomer',
          description:
            'Cadastra um cliente do profissional com nome e WhatsApp. Se o número já for de um cliente, devolve esse cliente.',
          inputSchema: z.strictObject({
            name: z.string().describe('Nome do cliente, como o profissional falou.'),
            phoneNumber: z.string().describe('WhatsApp do cliente com DDD. Ex.: 11987654321.'),
          }),
          run: async ({ name, phoneNumber }) => {
            const digits = toPhoneNumber(phoneNumber);
            if (!digits) throw new ToolError(`Telefone inválido: ${phoneNumber}. Peça o número com DDD.`);
            if (!name.trim()) throw new ToolError('Falta o nome do cliente.');
            const { customer, created } = await createCustomer(professional.id, { name, phoneNumber: digits });
            const prefix = created ? 'Cliente cadastrado' : 'Esse número já é de um cliente';
            return `${prefix}: ${JSON.stringify(toResult(customer))}`;
          },
        }),
      ),
    },
  ];
}

// In a Customer's thread, an Assistant hands the part of the request that is a teammate's over to them.
export function threadTools({ role, customer }: Assistant): AssistantTool[] {
  const teammates = customer?.team.filter((teammate) => teammate.role !== role) ?? [];
  if (!customer || !teammates.length) return [];
  const roles = teammates.map((teammate) => teammate.role) as [Assistant['role'], ...Assistant['role'][]];
  const described = teammates.map(
    (teammate) => `${teammate.role}: ${teammate.name}, ${catalogEntry(teammate.role).title}`,
  );
  return [
    {
      status: 'Chamando a equipe',
      inputStatus: (input) => {
        const teammate = teammates.find(({ role }) => role === (input as { role?: string }).role);
        return teammate && `Chamando ${teammate.name}`;
      },
      tool: strict(
        betaZodTool({
          name: 'askTeammate',
          description: `Chama um colega da equipe nesta conversa para fazer a parte dele do pedido. A mensagem aparece aqui para o profissional, e o colega responde logo depois de você. Colegas: ${described.join('; ')}.`,
          inputSchema: z.strictObject({
            role: z.enum(roles).describe('A função do colega.'),
            message: z
              .string()
              .describe(
                'O que o colega deve fazer, falando com ele pelo nome, com o que ele precisa saber. Ex.: "@Lia, o João aprovou a troca do compressor; veja um horário para a execução na semana que vem."',
              ),
          }),
          run: ({ role: teammateRole, message }) => {
            customer.handoffs.push({ role: teammateRole, message });
            const { name } = teammates.find((teammate) => teammate.role === teammateRole)!;
            return `${name} responde aqui logo depois de você. Não repita o pedido na sua resposta.`;
          },
        }),
      ),
    },
  ];
}

function toResult({ id, name, phoneNumber }: Customer) {
  return { id, name, phoneNumber };
}
