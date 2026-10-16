import * as z from 'zod';
import { type BriefingScript, step } from '../briefing/scripts';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24 horas');
export const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Weekday = (typeof weekdays)[number];
const weekdayNames: Record<Weekday, string> = {
  mon: 'seg',
  tue: 'ter',
  wed: 'qua',
  thu: 'qui',
  fri: 'sex',
  sat: 'sáb',
  sun: 'dom',
};

export const hours = z
  .array(
    z.strictObject({
      days: z.array(z.enum(weekdays)).min(1),
      start: time,
      end: time,
    }),
  )
  .min(1);

export const confirmations = z
  .strictObject({ when: z.enum(['day_before', 'same_day', 'on_request']), time: time.nullable() })
  .refine(({ when, time }) => (when === 'on_request') === (time === null), 'time só fica vazio em on_request');

export const schedulingBriefing: BriefingScript = {
  what: 'Marcar visitas e confirmar com os clientes',
  greeting: 'Vou marcar as suas visitas e confirmar com os clientes. Você só aprova.',
  connect: [
    { name: 'WhatsApp', reason: 'Mandar as confirmações aos clientes', availability: 'first_message' },
    { name: 'Google Agenda', reason: 'Se a sua agenda fica lá', availability: 'coming_soon' },
  ],
  steps: [
    step({
      key: 'agenda',
      label: 'Onde',
      question: 'Onde fica a sua agenda hoje?',
      guide:
        'Onde o profissional anotava a agenda antes do app: paper (caderno, papel), memory (de cabeça) ou other. A ligação com o Google Agenda ainda não existe: se ele usa o Google Agenda, use other e diga no reply que a ligação vem em breve e que, por enquanto, a agenda fica aqui no app.',
      schema: z.enum(['paper', 'memory', 'other']),
      options: [
        { key: 'google_calendar', label: 'Google Agenda', comingSoon: true },
        {
          key: 'paper',
          label: 'No caderno ou no papel',
          ack: 'Então eu viro a sua agenda. Pode aposentar o caderno.',
          value: 'paper',
        },
        {
          key: 'memory',
          label: 'Na cabeça',
          ack: 'Então eu viro a sua agenda. Você não precisa lembrar de mais nada.',
          value: 'memory',
        },
      ],
      format: () => 'Aqui no app',
    }),
    step({
      key: 'hours',
      label: 'Atende',
      question: 'Quais dias e horários você atende?',
      guide:
        'Os períodos de atendimento: cada um com os dias da semana (mon a sun) e o horário de início e fim (HH:MM). Horários diferentes em dias diferentes viram períodos separados.',
      schema: hours,
      options: [
        {
          key: 'weekdays',
          label: 'Seg a sex, das 8h às 18h',
          ack: 'Fechado. Só ofereço horários dentro disso.',
          value: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' }],
        },
        {
          key: 'weekdays_and_saturday_morning',
          label: 'Seg a sáb, sábado até 12h',
          ack: 'Fechado. Só ofereço horários dentro disso.',
          value: [
            { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' },
            { days: ['sat'], start: '08:00', end: '12:00' },
          ],
        },
        {
          key: 'every_day',
          label: 'Todos os dias',
          ack: 'Fechado. Ofereço qualquer dia, sempre com folga entre as visitas.',
          value: [{ days: [...weekdays], start: '08:00', end: '18:00' }],
        },
      ],
      format: (periods) =>
        capitalize(
          periods
            .map(({ days, start, end }) => `${formatDays(days)}, ${formatTime(start)} às ${formatTime(end)}`)
            .join('; '),
        ),
    }),
    step({
      key: 'booking',
      label: 'Sozinha',
      question: 'Quando um cliente pedir horário…',
      guide:
        'O quanto o assistente faz sozinho quando um cliente pede horário: book (oferece os horários livres e marca), ask_first (pergunta ao profissional antes de marcar) ou draft_reply (só escreve a resposta, o profissional envia).',
      schema: z.enum(['book', 'ask_first', 'draft_reply']),
      options: [
        {
          key: 'book',
          label: 'Ofereça os horários livres e marque',
          hint: 'Eu marco e te aviso',
          ack: 'Combinado. Eu marco e te aviso na hora.',
          value: 'book',
        },
        {
          key: 'ask_first',
          label: 'Me pergunte antes de marcar',
          hint: 'Você aprova cada visita',
          ack: 'Combinado. Eu preparo a resposta e espero o seu ok.',
          value: 'ask_first',
        },
        {
          key: 'draft_reply',
          label: 'Só escreva a resposta',
          hint: 'Você mesmo envia',
          ack: 'Combinado. Eu escrevo e você só envia.',
          value: 'draft_reply',
        },
      ],
      format: (booking) =>
        ({
          book: 'Marca sozinha nos horários livres',
          ask_first: 'Pergunta antes de marcar',
          draft_reply: 'Só escreve a resposta',
        })[booking],
    }),
    step({
      key: 'confirmations',
      label: 'Quando',
      pre: 'Confirmando antes, dá tempo de encaixar outro cliente se alguém desmarcar.',
      question: 'A que horas eu confirmo as visitas?',
      guide:
        'Quando confirmar as visitas com os clientes: day_before (na véspera) ou same_day (no dia), com o horário (HH:MM); ou on_request (só quando o profissional pedir, time null).',
      schema: confirmations,
      options: [
        {
          key: 'day_before',
          label: 'Na véspera, às 18h',
          hint: 'Vira uma rotina minha',
          ack: 'Fechado: na véspera, às 18h. Isso vira uma rotina minha.',
          value: { when: 'day_before', time: '18:00' },
        },
        {
          key: 'same_day',
          label: 'No dia, às 7h',
          hint: 'Vira uma rotina minha',
          ack: 'Fechado: no dia, às 7h. Isso vira uma rotina minha.',
          value: { when: 'same_day', time: '07:00' },
        },
        {
          key: 'on_request',
          label: 'Só quando você pedir',
          hint: 'Sem rotina',
          ack: 'Fechado. Só confirmo quando você pedir.',
          value: { when: 'on_request', time: null },
        },
      ],
      format: ({ when, time }) =>
        when === 'on_request'
          ? 'Quando você pedir'
          : `${when === 'day_before' ? 'Na véspera' : 'No dia'}, às ${formatTime(time!)}`,
      routine: ({ when, time }) =>
        when === 'on_request'
          ? null
          : `Confirmações ${when === 'day_before' ? 'na véspera' : 'no dia'}, às ${formatTime(time!)}`,
    }),
  ],
  done: 'Pronto! A partir de agora a agenda é comigo. É só me pedir para marcar, remarcar ou cancelar uma visita.',
};

function formatDays(days: Weekday[]) {
  const sorted = weekdays.filter((day) => days.includes(day));
  if (sorted.length === weekdays.length) return 'todos os dias';
  const first = weekdays.indexOf(sorted[0]!);
  const consecutive = sorted.every((day, index) => weekdays.indexOf(day) === first + index);
  if (consecutive && sorted.length > 2) return `${weekdayNames[sorted[0]!]} a ${weekdayNames[sorted.at(-1)!]}`;
  return sorted.map((day) => weekdayNames[day]).join(', ');
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  return `${Number(hours)}h${minutes === '00' ? '' : minutes}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
