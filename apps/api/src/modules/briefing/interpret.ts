import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod';
import { modelParams, recordUsage } from '../conversations/service';
import type { BriefingStep } from './scripts';

type Interpretation = { value: unknown; reply: string } | { value: null; reply: string };

const notUnderstood = 'Não entendi. Pode escolher uma das opções ou dizer de outro jeito?';

const system = `Você ajuda um assistente do Acme, um app de assistentes de IA para profissionais que atendem na casa ou na empresa dos clientes, a combinar com o profissional como ele deve trabalhar. O app fez uma pergunta com opções prontas e o profissional respondeu com as próprias palavras. Encaixe a resposta no campo da ficha.

- Preencha value seguindo o esquema, com o que ele disse. Se a resposta equivale a uma das opções prontas, use o valor dela.
- Se a resposta não responde à pergunta, ou faltar algo que o campo exige, use understood: false e value: null.
- reply é uma frase curta em português do Brasil, sem markdown, como um colega de trabalho. Se entendeu, confirme o que anotou (ex.: "Fechado: seg a sex, das 7h às 17h."). Se não entendeu, diga o que faltou.`;

// The LLM only runs for free text; chips go straight into the Playbook.
export async function interpret(
  assistant: { id: string; professional: { id: string } },
  step: BriefingStep,
  text: string,
): Promise<Interpretation> {
  const schema = z.strictObject({ understood: z.boolean(), value: step.schema.nullable(), reply: z.string() });
  const options = step.options
    .flatMap((option) => ('value' in option ? [`- ${option.label}: ${JSON.stringify(option.value)}`] : []))
    .join('\n');
  const format = betaZodOutputFormat(schema);
  const message = await new Anthropic().beta.messages.create({
    ...modelParams(),
    max_tokens: 2000,
    output_config: { effort: 'low', format },
    system,
    messages: [
      {
        role: 'user',
        content: `Pergunta: ${step.question}\nO que o campo guarda: ${step.guide}\nOpções prontas e o valor de cada uma:\n${options}\n\n<resposta>${text}</resposta>`,
      },
    ],
  });
  // create, not parse: parse throws on an output outside the schema before the usage can be recorded.
  await recordUsage(assistant, message);

  const output = message.content.find((block) => block.type === 'text')?.text;
  if (message.stop_reason !== 'end_turn' || !output) return { value: null, reply: notUnderstood };
  try {
    const { understood, value, reply } = format.parse(output);
    if (!understood || value === null) return { value: null, reply: reply || notUnderstood };
    return { value, reply };
  } catch (error) {
    if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError)
      return { value: null, reply: notUnderstood };
    throw error;
  }
}
