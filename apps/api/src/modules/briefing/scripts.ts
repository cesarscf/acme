import * as z from 'zod';
import { pixBrCode } from '../pix/br-code';
import { formatPixKey, parsePixKey, pixKeyTypes } from '../pix/pix-key';
import type { AssistantRole } from '../team/catalog';

type Option<Value> =
  | { key: string; label: string; hint?: string; ack: string; value: Value }
  // Shown as "em breve": the integration does not exist in the MVP.
  | { key: string; label: string; hint?: string; comingSoon: true };

type Parsed<Value> = { value: Value; ack: string } | { error: string };

// A step with a parse reads free text itself, so a Pix key never goes to Claude.
type TextAnswer<Value> =
  | { guide: string; parse?: undefined }
  | { guide?: undefined; parse: (text: string) => Parsed<Value> };

type StepDefinition<Value> = {
  key: string;
  label: string;
  pre?: string;
  question: string;
  schema: z.ZodType<Value>;
  options: Option<NoInfer<Value>>[];
  format: (value: NoInfer<Value>) => string;
  routine?: (value: NoInfer<Value>) => string | null;
} & TextAnswer<NoInfer<Value>>;

export type BriefingStep = {
  key: string;
  label: string;
  pre?: string;
  question: string;
  schema: z.ZodType;
  options: Option<unknown>[];
  guide?: string;
  parse?: (text: string) => Parsed<unknown>;
  describe: (value: unknown) => { step: string; label: string; value: string; routine: string | null } | undefined;
};

export type BriefingScript = {
  what: string;
  greeting: string;
  connect: { name: string; reason: string; availability: 'first_message' | 'coming_soon' }[];
  steps: BriefingStep[];
  testPix?: (playbook: Record<string, unknown>) => { text: string; code: string } | null;
  done: string;
};

function step<Value>(definition: StepDefinition<Value>): BriefingStep {
  const { format, routine, ...rest } = definition;
  return {
    ...rest,
    describe: (value) => {
      const parsed = definition.schema.safeParse(value);
      if (!parsed.success) return undefined;
      return {
        step: definition.key,
        label: definition.label,
        value: format(parsed.data),
        routine: routine?.(parsed.data) ?? null,
      };
    },
  };
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24 horas');
const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
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

const hours = z
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

const visitFee = z
  .strictObject({ kind: z.enum(['free', 'fixed', 'waived_if_hired']), amountCents: z.int().positive().nullable() })
  .refine(({ kind, amountCents }) => kind !== 'free' || amountCents === null, 'visita grátis não tem valor');

export const quoteValidity = z.int().min(1).max(90);

export const followUp = z
  .strictObject({ action: z.enum(['remind', 'notify_me', 'nothing']), afterDays: z.int().min(1).max(30).nullable() })
  .refine(
    ({ action, afterDays }) => (action === 'nothing') === (afterDays === null),
    'afterDays só fica vazio em nothing',
  );

const scheduling: BriefingScript = {
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

const quotes: BriefingScript = {
  what: 'Montar orçamentos e acompanhar quem não respondeu',
  greeting: 'Vou montar os seus orçamentos a partir de um áudio ou de uma descrição do serviço.',
  connect: [{ name: 'WhatsApp', reason: 'Mandar o orçamento ao cliente', availability: 'first_message' }],
  steps: [
    step({
      key: 'priceList',
      label: 'Preços',
      pre: 'Para montar o orçamento do seu jeito, preciso dos seus preços.',
      question: 'Você tem uma tabela de preços?',
      guide:
        'Como o assistente fica sabendo dos preços: typed (o profissional passa os preços da tabela dele) ou per_job (não tem tabela, define o valor de cada serviço).',
      schema: z.enum(['typed', 'per_job']),
      options: [
        { key: 'photo', label: 'Tenho, vou mandar foto', hint: 'Eu leio a foto', comingSoon: true },
        {
          key: 'typed',
          label: 'Tenho, vou digitar',
          ack: 'Ótimo. Pode mandar do jeito que estiver, eu organizo.',
          value: 'typed',
        },
        {
          key: 'per_job',
          label: 'Não, cobro por serviço',
          hint: 'Você me diz o valor de cada um',
          ack: 'Sem problema. Eu monto e você só coloca o valor.',
          value: 'per_job',
        },
      ],
      format: (priceList) =>
        ({ typed: 'Você me passa os preços', per_job: 'Você define o valor de cada um' })[priceList],
    }),
    step({
      key: 'visitFee',
      label: 'Visita',
      question: 'Como você cobra a visita técnica?',
      guide:
        'A visita técnica: free (grátis), fixed (valor fixo) ou waived_if_hired (cobra, mas desconta se o cliente fechar o serviço). amountCents é o valor em centavos, ou null se ele não disse ou se é grátis.',
      schema: visitFee,
      options: [
        { key: 'free', label: 'Grátis', ack: 'Anotado: visita grátis.', value: { kind: 'free', amountCents: null } },
        {
          key: 'fixed',
          label: 'Valor fixo',
          hint: 'O valor você põe depois na ficha',
          ack: 'Anotado: valor fixo. O valor você coloca na ficha quando quiser.',
          value: { kind: 'fixed', amountCents: null },
        },
        {
          key: 'waived_if_hired',
          label: 'Desconta se fechar o serviço',
          ack: 'Anotado: desconta se fechar.',
          value: { kind: 'waived_if_hired', amountCents: null },
        },
      ],
      format: ({ kind, amountCents }) => {
        const amount = amountCents === null ? null : formatMoney(amountCents);
        if (kind === 'free') return 'Grátis';
        if (kind === 'fixed') return amount ?? 'Valor fixo';
        return amount ? `${amount}, desconta se fechar` : 'Desconta se fechar';
      },
    }),
    step({
      key: 'quoteValidity',
      label: 'Validade',
      question: 'Por quanto tempo o orçamento vale?',
      guide: 'Quantos dias o orçamento vale depois de enviado, de 1 a 90.',
      schema: quoteValidity,
      options: [7, 15, 30].map((days) => ({
        key: `${days}_days`,
        label: `${days} dias`,
        ack: `Fechado: ${days} dias.`,
        value: days,
      })),
      format: (days) => (days === 1 ? '1 dia' : `${days} dias`),
    }),
    step({
      key: 'followUp',
      label: 'Sozinha',
      pre: 'Muito orçamento se perde por falta de um lembrete.',
      question: 'Se o cliente não responder…',
      guide:
        'O que fazer quando o cliente não responde o orçamento: remind (lembra o cliente sozinha, uma vez), notify_me (avisa o profissional, que decide) ou nothing (não faz nada). afterDays é depois de quantos dias (null só em nothing).',
      schema: followUp,
      options: [
        {
          key: 'remind',
          label: 'Lembre em 2 dias, sozinha',
          hint: 'Vira uma rotina minha',
          ack: 'Combinado. Eu lembro com jeito, uma vez só.',
          value: { action: 'remind', afterDays: 2 },
        },
        {
          key: 'notify_me',
          label: 'Me avise e eu decido',
          ack: 'Combinado. Eu te aviso e você decide.',
          value: { action: 'notify_me', afterDays: 2 },
        },
        {
          key: 'nothing',
          label: 'Não faça nada',
          ack: 'Combinado. Não insisto.',
          value: { action: 'nothing', afterDays: null },
        },
      ],
      format: ({ action, afterDays }) => {
        const days = afterDays === 1 ? '1 dia' : `${afterDays} dias`;
        if (action === 'remind') return `Lembra o cliente em ${days}`;
        if (action === 'notify_me') return `Te avisa em ${days} e você decide`;
        return 'Não insiste';
      },
      routine: ({ action, afterDays }) => {
        const days = afterDays === 1 ? 'em 1 dia' : `em ${afterDays} dias`;
        if (action === 'remind') return `Lembrete do orçamento ${days}`;
        if (action === 'notify_me') return `Aviso do orçamento sem resposta ${days}`;
        return null;
      },
    }),
  ],
  done: 'Pronto! É só me mandar um áudio ou uma descrição do serviço que eu monto o orçamento e te mostro antes de enviar.',
};

const paymentMethodKinds = ['pix', 'cash'] as const;

// The billing Assistant charges through Pix, so the Pix key is always one of the PaymentMethods.
export const paymentMethods = z
  .strictObject({ accepted: z.array(z.enum(paymentMethodKinds)).min(1), default: z.enum(paymentMethodKinds) })
  .refine(({ accepted }) => accepted.includes('pix'), 'pix sempre entra')
  .refine(({ accepted }) => new Set(accepted).size === accepted.length, 'sem repetir')
  .refine(({ accepted, default: preferred }) => accepted.includes(preferred), 'a padrão é uma das aceitas');

export const pixKey = z.strictObject({ type: z.enum(pixKeyTypes), key: z.string() }).refine(({ type, key }) => {
  const parsed = parsePixKey(key);
  return 'key' in parsed && parsed.type === type && parsed.key === key;
}, 'chave Pix inválida');

// The BR Code carries only ASCII, so a name without Latin letters would come out empty.
const words = (max: number) =>
  z
    .string()
    .trim()
    .min(2)
    .max(max)
    .regex(/[a-zà-ÿ]/i);
export const pixName = words(60);
export const pixCity = words(40);

function parseWords(schema: z.ZodType<string>, error: string) {
  return (text: string): Parsed<string> => {
    const parsed = schema.safeParse(text.replace(/\s+/g, ' '));
    return parsed.success ? { value: parsed.data, ack: `Anotado: ${parsed.data}.` } : { error };
  };
}

const billing: BriefingScript = {
  what: 'Gerar o Pix, confirmar o pagamento e lembrar quem atrasou',
  greeting: 'Vou cuidar das suas cobranças no Pix, com jeito.',
  connect: [
    { name: 'WhatsApp', reason: 'Mandar a cobrança ao cliente', availability: 'first_message' },
    { name: 'Banco', reason: 'Ver quando o dinheiro caiu', availability: 'coming_soon' },
  ],
  steps: [
    step({
      key: 'paymentMethods',
      label: 'Recebe',
      question: 'Como você aceita receber?',
      guide:
        'As formas de receber que o profissional aceita (accepted) e a padrão (default), que vem marcada quando ele registra um serviço: pix ou cash (dinheiro). pix sempre entra, porque a cobrança é no Pix. Cartão e conectar o banco ainda não existem: se ele falar deles, deixe de fora e diga no reply que vêm em breve. Se ele não disser qual é a padrão, use pix.',
      schema: paymentMethods,
      options: [
        {
          key: 'pix_and_cash',
          label: 'Pix e dinheiro',
          hint: 'O Pix vem marcado',
          ack: 'Anotado: Pix e dinheiro.',
          value: { accepted: ['pix', 'cash'], default: 'pix' },
        },
        {
          key: 'pix',
          label: 'Só Pix',
          ack: 'Anotado: só Pix.',
          value: { accepted: ['pix'], default: 'pix' },
        },
        { key: 'bank', label: 'Conectar banco', hint: 'Vejo quando o dinheiro cai', comingSoon: true },
        { key: 'card', label: 'Cartão', comingSoon: true },
      ],
      format: ({ accepted, default: preferred }) =>
        accepted.length === 1 ? 'Só Pix' : `Pix e dinheiro, ${preferred === 'pix' ? 'o Pix' : 'o dinheiro'} por padrão`,
    }),
    step({
      key: 'pixKey',
      label: 'Chave Pix',
      pre: 'Para gerar o Pix, preciso da chave da conta onde você quer receber.',
      question: 'Qual é a sua chave Pix?',
      schema: pixKey,
      options: [],
      parse: (text) => {
        const parsed = parsePixKey(text);
        if ('error' in parsed) return parsed;
        // An 11 digit key may be a CPF or a cell phone; a valid CPF wins, and +55 picks the phone.
        const maybePhone =
          parsed.type === 'cpf' && parsed.key[2] === '9' ? ' Se for um celular, escreva com +55 na frente.' : '';
        return { value: parsed, ack: `Anotei a chave: ${formatPixKey(parsed)}.${maybePhone}` };
      },
      format: formatPixKey,
    }),
    step({
      key: 'pixName',
      label: 'Nome',
      question: 'Qual é o seu nome, do jeito que está no banco?',
      schema: pixName,
      options: [],
      parse: parseWords(pixName, 'Escreva o nome do jeito que aparece no app do banco.'),
      format: (name) => name,
    }),
    step({
      key: 'pixCity',
      label: 'Cidade',
      pre: 'O Pix também leva a sua cidade.',
      question: 'Em que cidade você está?',
      schema: pixCity,
      options: [],
      parse: parseWords(pixCity, 'Escreva só o nome da cidade, como São Paulo.'),
      format: (city) => city,
    }),
  ],
  // ADR 0005: a wrong key sends the money to someone else, so the Professional checks the name in the bank app.
  testPix: (playbook) => {
    const key = pixKey.safeParse(playbook.pixKey);
    const name = pixName.safeParse(playbook.pixName);
    const city = pixCity.safeParse(playbook.pixCity);
    if (!key.success || !name.success || !city.success) return null;
    return {
      text: 'Para conferir a chave, copie este Pix de teste de R$ 0,01, cole no app do seu banco em "Pix copia e cola" e veja se aparece o seu nome. Não precisa pagar.',
      code: pixBrCode({ key: key.data.key, name: name.data, city: city.data, amountCents: 1 }),
    };
  },
  done: 'Pronto! É só me pedir uma cobrança que eu preparo o Pix e te mostro antes de mandar.',
};

export const briefingScripts: Partial<Record<AssistantRole, BriefingScript>> = { scheduling, quotes, billing };

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

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
