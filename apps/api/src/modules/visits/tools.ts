import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import * as z from 'zod';
import type { Assistant } from '../conversations/service';
import { type AssistantTool, confirmed, strict } from '../conversations/tools';
import { findCustomer, formatPhoneNumber } from '../customers/service';
import {
  cancelVisit,
  createVisit,
  findConflicts,
  findVisit,
  listVisits,
  rescheduleVisit,
  sendVisitConfirmation,
  type VisitWithCustomer,
} from './service';
import { formatLocalDateTime, localDate, toInstant } from './time';

const defaultDurationMinutes = 60;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'AAAA-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24 horas');
const allowConflict = z
  .boolean()
  .describe(
    'false na primeira tentativa. true só depois de o profissional dizer que quer marcar mesmo batendo com outra visita.',
  );

export function visitTools({ professional }: Assistant): AssistantTool[] {
  const timeZone = professional.timezone;

  const toResult = ({ id, customer, scheduledAt, durationMinutes, status }: VisitWithCustomer) => ({
    id,
    customer: { id: customer.id, name: customer.name },
    when: formatLocalDateTime(scheduledAt, timeZone),
    durationMinutes,
    status,
  });

  async function ownVisit(visitId: string) {
    const visit = await findVisit(professional.id, visitId);
    if (!visit) throw new ToolError(`Visita ${visitId} não encontrada. Use listVisits para achar o id.`);
    return visit;
  }

  function futureInstant(day: string, at: string) {
    const scheduledAt = toInstant(day, at, timeZone);
    // Date.UTC rolls 31/02 over to March, so a date that does not read back the same does not exist.
    if (Number.isNaN(scheduledAt.getTime()) || localDate(scheduledAt, timeZone) !== day) {
      throw new ToolError(`Data ou horário inválido: ${day} ${at}.`);
    }
    if (scheduledAt.getTime() < Date.now())
      throw new ToolError(`${formatLocalDateTime(scheduledAt, timeZone)} já passou.`);
    return scheduledAt;
  }

  function conflictWarning(conflicts: VisitWithCustomer[]) {
    return `Não marquei: o horário dá conflito com ${JSON.stringify(conflicts.map(toResult))}. Avise o profissional e pergunte se marca mesmo assim. Se ele quiser, chame de novo com allowConflict true.`;
  }

  return [
    {
      tool: strict(
        betaZodTool({
          name: 'listVisits',
          description: 'Lista as visitas marcadas (sem as canceladas) entre duas datas, no fuso do profissional.',
          inputSchema: z.strictObject({
            from: date.describe('Primeiro dia, AAAA-MM-DD.'),
            to: date.describe('Último dia, AAAA-MM-DD (inclusive).'),
          }),
          run: async ({ from, to }) => {
            const found = await listVisits(professional.id, timeZone, from, to);
            if (!found.length) return `Nenhuma visita entre ${from} e ${to}.`;
            return JSON.stringify(found.map(toResult));
          },
        }),
      ),
    },
    {
      tool: strict(
        betaZodTool({
          name: 'createVisit',
          description:
            'Marca uma visita para um cliente já cadastrado (use findCustomer ou createCustomer antes para ter o id). Se o horário bater com outra visita, não marca e avisa.',
          inputSchema: z.strictObject({
            customerId: z.string().describe('id do cliente.'),
            date: date.describe('Dia da visita, AAAA-MM-DD, no fuso do profissional.'),
            time: time.describe('Hora de início, HH:MM.'),
            durationMinutes: z
              .int()
              .positive()
              .nullable()
              .describe(`Duração em minutos, se o profissional disser. Vazio usa ${defaultDurationMinutes}.`),
            allowConflict,
          }),
          run: async (input) => {
            const customer = await findCustomer(professional.id, input.customerId);
            if (!customer) throw new ToolError(`Cliente ${input.customerId} não encontrado. Use findCustomer.`);
            const timing = {
              scheduledAt: futureInstant(input.date, input.time),
              durationMinutes: input.durationMinutes ?? defaultDurationMinutes,
            };
            const conflicts = await findConflicts(professional.id, timing);
            if (conflicts.length && !input.allowConflict) return conflictWarning(conflicts);
            const visit = await createVisit(professional.id, customer.id, timing);
            return `Visita marcada: ${JSON.stringify(toResult({ ...visit, customer }))}`;
          },
        }),
      ),
    },
    {
      tool: strict(
        betaZodTool({
          name: 'rescheduleVisit',
          description:
            'Muda o dia ou o horário de uma visita. A visita volta a esperar a confirmação do cliente. Se o novo horário bater com outra visita, não muda e avisa.',
          inputSchema: z.strictObject({
            visitId: z.string().describe('id da visita.'),
            date: date.describe('Novo dia, AAAA-MM-DD.'),
            time: time.describe('Novo horário, HH:MM.'),
            allowConflict,
          }),
          run: async (input) => {
            const visit = await ownVisit(input.visitId);
            if (visit.status === 'cancelled') throw new ToolError('Essa visita foi cancelada. Marque uma nova.');
            const scheduledAt = futureInstant(input.date, input.time);
            const conflicts = await findConflicts(professional.id, { ...visit, scheduledAt }, visit.id);
            if (conflicts.length && !input.allowConflict) return conflictWarning(conflicts);
            await rescheduleVisit(visit.id, scheduledAt);
            return `Visita remarcada: ${JSON.stringify(toResult({ ...visit, scheduledAt, status: 'scheduled' }))}`;
          },
        }),
      ),
    },
    {
      tool: strict(
        betaZodTool({
          name: 'cancelVisit',
          description: 'Cancela uma visita. Nada é enviado ao cliente.',
          inputSchema: z.strictObject({ visitId: z.string().describe('id da visita.') }),
          run: async ({ visitId }) => {
            const visit = await ownVisit(visitId);
            await cancelVisit(visit.id);
            return `Visita cancelada: ${JSON.stringify(toResult({ ...visit, status: 'cancelled' }))}`;
          },
        }),
      ),
    },
    confirmed(
      betaZodTool({
        name: 'sendVisitConfirmation',
        description:
          'Manda ao cliente, no WhatsApp, a mensagem que pede para confirmar a visita, com os botões Confirmar e Remarcar. O profissional vê um cartão e só depois de ele tocar em Confirmar a mensagem sai. Quando o cliente tocar num botão, aparece um <aviso> na conversa.',
        inputSchema: z.strictObject({ visitId: z.string().describe('id da visita.') }),
        run: async ({ visitId }) => {
          const visit = await ownVisit(visitId);
          if (visit.status === 'cancelled') throw new ToolError('Essa visita foi cancelada.');
          await sendVisitConfirmation(visit, professional);
          return `Confirmação enviada para ${visit.customer.name} no WhatsApp.`;
        },
      }),
      async ({ visitId }) => {
        const visit = await findVisit(professional.id, visitId);
        const name = visit?.customer.name ?? 'o cliente';
        return {
          title: `Para confirmar: pedir a confirmação de ${name}`,
          subtitle: name,
          rows: visit
            ? [
                { label: 'Cliente', value: visit.customer.name },
                { label: 'WhatsApp', value: formatPhoneNumber(visit.customer.phoneNumber) },
                { label: 'Visita', value: formatLocalDateTime(visit.scheduledAt, timeZone) },
              ]
            : [],
          notices: [
            'Nada é enviado agora.',
            `Depois que você confirmar, ${name} recebe a mensagem no WhatsApp com os botões Confirmar e Remarcar.`,
          ],
          question: `Confirma: pedir para ${name} confirmar a visita?`,
        };
      },
    ),
  ];
}
