import * as z from 'zod';
import { type BriefingScript, formatMoney, step } from '../briefing/scripts';

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

export const quotesBriefing: BriefingScript = {
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
