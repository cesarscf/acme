import * as z from 'zod';
import { type BriefingScript, type Parsed, step } from '../briefing/scripts';
import { pixBrCode } from '../pix/br-code';
import { formatPixKey, parsePixKey, pixKeyTypes } from '../pix/pix-key';

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

export const billingBriefing: BriefingScript = {
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
      // The reminder Routine has no step of its own yet and runs with the spec's default.
      routine: () => 'Lembrete do Pix pendente, 1 dia depois',
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
