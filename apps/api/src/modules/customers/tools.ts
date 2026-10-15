import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import type { Assistant } from '../conversations/service';
import { type AssistantTool, strict } from '../conversations/tools';
import { type Customer, createCustomer, findCustomers, toPhoneNumber } from './service';

export function customerTools({ professional }: Assistant): AssistantTool[] {
  return [
    {
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

function toResult({ id, name, phoneNumber }: Customer) {
  return { id, name, phoneNumber };
}
