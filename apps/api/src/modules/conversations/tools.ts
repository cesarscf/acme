import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import { sendMessage } from '../whatsapp/service';

export type ConfirmationCard = {
  title: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  notices: string[];
  question: string;
};

// A tool with a card only runs after the Professional taps Confirmar on it.
export type AssistantTool = {
  tool: BetaRunnableTool;
  card?: (input: unknown) => ConfirmationCard;
};

function strict<Input>(tool: BetaRunnableTool<Input>) {
  return { ...tool, strict: true };
}

function confirmed<Input>(tool: BetaRunnableTool<Input>, card: (input: Input) => ConfirmationCard): AssistantTool {
  return { tool: strict(tool), card: (input) => card(tool.parse(input)) };
}

// Example of a tool that reaches the Customer, until the Role tools (ticket 09 onwards) replace it.
const sendCustomerMessage = confirmed(
  betaZodTool({
    name: 'sendCustomerMessage',
    description:
      'Manda uma mensagem de texto no WhatsApp para um cliente do profissional. O profissional vê um cartão e só depois de ele tocar em Confirmar a mensagem sai.',
    inputSchema: z.strictObject({
      customerName: z.string().describe('Nome do cliente, como o profissional falou.'),
      phoneNumber: z.string().describe('WhatsApp do cliente com 55 e DDD, só números. Ex.: 5511987654321.'),
      text: z.string().describe('A mensagem, escrita como o profissional escreveria para o cliente.'),
    }),
    run: async ({ customerName, phoneNumber, text }) => {
      const to = phoneNumber.replace(/\D/g, '');
      if (!/^55\d{10,11}$/.test(to)) throw new ToolError(`Telefone inválido: ${phoneNumber}. Peça o número com DDD.`);
      // ADR 0003: the Customer channel is the Professional's own number, connected in ticket 18; M1 sends from the platform's.
      await sendMessage({
        from: env('META_PLATFORM_PHONE_NUMBER_ID'),
        to,
        message: { type: 'text', text: { body: text } },
      });
      return `Mensagem enviada para ${customerName} no WhatsApp.`;
    },
  }),
  ({ customerName, phoneNumber, text }) => ({
    title: `Para confirmar: mandar mensagem para ${customerName}`,
    subtitle: customerName,
    rows: [
      { label: 'Cliente', value: customerName },
      { label: 'WhatsApp', value: formatPhone(phoneNumber) },
      { label: 'Mensagem', value: text },
    ],
    notices: ['Nada é enviado agora.', `Depois que você confirmar, ${customerName} recebe a mensagem no WhatsApp.`],
    question: `Confirma: mandar a mensagem para ${customerName}?`,
  }),
);

export function assistantTools(): AssistantTool[] {
  return [sendCustomerMessage];
}

function formatPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, '');
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phoneNumber;
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
