import { assistantMessages, assistants, db, toolConfirmations } from '@acme/db';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { and, asc, eq } from 'drizzle-orm';
import * as z from 'zod';
import type { Handoff } from '../conversations/prompts';
import {
  type Assistant,
  claude,
  findAssistant,
  modelParams,
  recordUsage,
  sendText,
  type TurnEvent,
} from '../conversations/service';
import { catalogEntry } from '../team/catalog';
import { roles } from '../team/roles';
import { type CustomerThread, getCustomerThread } from './thread';

type ThreadItem = CustomerThread['items'][number];

const routerSystem = `Você encaminha a mensagem que um profissional escreveu na conversa de um cliente, no app, para o assistente da equipe dele que cuida daquilo. Responda só com a função (role) do assistente, entre as da equipe.

- Se a mensagem responde a uma pergunta ou a um cartão do último assistente que falou, é dele.
- Se não der para saber, é de quem falou por último; se ninguém falou ainda, do primeiro da lista.`;

// A request passed along can come back, so a message moves the team at most this many times.
const maxHandoffs = 4;

function listTeam(professionalId: string) {
  return db
    .select({ id: assistants.id, role: assistants.role, name: assistants.name })
    .from(assistants)
    .where(eq(assistants.professionalId, professionalId))
    .orderBy(asc(assistants.createdAt), asc(assistants.role));
}

export async function inCustomerThread(assistant: Assistant, thread: CustomerThread): Promise<Assistant> {
  const team = await listTeam(assistant.professional.id);
  return {
    ...assistant,
    customer: { ...thread.customer, history: describeThread(thread), team, handoffs: [] },
  };
}

// The Professional's message starts with one Assistant; each teammate it asks answers right after, in the same thread.
export async function runTeam(
  first: Assistant,
  step: (assistant: Assistant, emit: (event: TurnEvent) => void) => Promise<TurnEvent>,
  emit: (event: TurnEvent) => void,
) {
  const professionalId = first.professional.id;
  const customerId = first.customer!.id;
  const queue: (Handoff & { from: string })[] = [];
  let assistant = first;
  let run = step;
  for (let hop = 0; ; hop++) {
    emit({ type: 'assistant', assistantId: assistant.id });
    const end = await run(assistant, emit);
    queue.push(...assistant.customer!.handoffs.map((handoff) => ({ ...handoff, from: assistant.name })));
    const next = queue.shift();
    if (!next || end.type === 'error' || hop === maxHandoffs) return end;
    const teammate = (await listTeam(professionalId)).find(({ role }) => role === next.role);
    const found = teammate && (await findAssistant(professionalId, teammate.id));
    if (!found) return end;
    assistant = await inCustomerThread(found, (await getCustomerThread(professionalId, customerId))!);
    run = (asked, emitTo) => sendText(asked, `<colega nome="${next.from}">${next.message}</colega>`, emitTo);
  }
}

export async function chooseAssistant(professionalId: string, thread: CustomerThread, text: string) {
  const team = await listTeam(professionalId);
  if (!team.length) return undefined;
  const lastSpeaker = thread.items.findLast((item) => item.type === 'assistant')?.assistant.id;
  const fallback = team.find(({ id }) => id === lastSpeaker) ?? team[0]!;
  const role = team.length === 1 ? fallback.role : await route(professionalId, team, thread, text);
  const chosen = team.find((assistant) => assistant.role === role) ?? fallback;
  return findAssistant(professionalId, chosen.id);
}

async function route(
  professionalId: string,
  team: { role: Assistant['role']; name: string }[],
  thread: CustomerThread,
  text: string,
) {
  const teamRoles = team.map(({ role }) => role) as [Assistant['role'], ...Assistant['role'][]];
  const format = betaZodOutputFormat(z.strictObject({ role: z.enum(teamRoles) }));
  const teamList = team
    .map(({ role, name }) => `- ${role}: ${name}, ${catalogEntry(role).title}. ${roles[role].scope}`)
    .join('\n');
  const recent = thread.items
    .filter((item) => ['professional', 'assistant', 'handoff', 'confirmation'].includes(item.type))
    .slice(-6)
    .map(describeItem)
    .join('\n');
  const message = await claude().beta.messages.create({
    ...modelParams(),
    max_tokens: 200,
    output_config: { effort: 'low', format },
    system: routerSystem,
    messages: [
      {
        role: 'user',
        content: `Equipe:\n${teamList}\n\nÚltimas mensagens da conversa:\n${recent || '(nenhuma)'}\n\n<mensagem>${text}</mensagem>`,
      },
    ],
  });
  await recordUsage({ id: null, professional: { id: professionalId } }, message);
  const output = message.content.find((block) => block.type === 'text')?.text;
  if (message.stop_reason !== 'end_turn' || !output) return undefined;
  try {
    return format.parse(output).role;
  } catch (error) {
    if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

export async function findThreadConfirmation(professionalId: string, customerId: string, id: string) {
  const [row] = await db
    .select({ confirmation: toolConfirmations })
    .from(toolConfirmations)
    .innerJoin(assistantMessages, eq(assistantMessages.id, toolConfirmations.messageId))
    .innerJoin(assistants, eq(assistants.id, toolConfirmations.assistantId))
    .where(
      and(
        eq(toolConfirmations.id, id),
        eq(toolConfirmations.status, 'pending'),
        eq(assistantMessages.customerId, customerId),
        eq(assistants.professionalId, professionalId),
      ),
    );
  return row?.confirmation;
}

// The tools take ids, so the history the Assistant reads carries them.
function describeThread({ customer, pinned, items }: CustomerThread) {
  const lines = [`Cliente: ${customer.name}, WhatsApp ${customer.phoneNumber}.`];
  if (pinned) {
    const steps = pinned.steps.map(({ label, state }) => `${label}: ${stepNames[state]}`).join(', ');
    lines.push(`Atendimento ${pinned.label.toLowerCase()}: ${pinned.title} · ${pinned.status.label} (${steps}).`);
  } else {
    lines.push('Nenhum atendimento em andamento.');
  }
  lines.push(...items.map(describeItem));
  return lines.join('\n');
}

const stepNames = { done: 'feito', current: 'agora', todo: 'falta', optional: 'opcional', skipped: 'pulado' } as const;
const decisionNames = { pending: 'esperando o profissional', confirmed: 'confirmado', cancelled: 'cancelado' } as const;

function describeItem(item: ThreadItem): string {
  const ref = item.id.slice(item.id.indexOf(':') + 1);
  switch (item.type) {
    case 'day':
      return `-- ${item.label} --`;
    case 'past_job':
      return `Atendimento anterior, ${item.date}: ${item.title}${item.detail ? ` · ${item.detail}` : ''} · ${item.status.label}`;
    case 'job_start':
      return `Novo atendimento: ${item.title}`;
    case 'visit':
      return `Visita (id ${ref}): ${item.title} · ${item.status.label}`;
    case 'work_record':
      return `${item.label}, ${item.when}: ${item.rows.map(({ label, value }) => `${label} ${value}`).join(' · ')}`;
    case 'quote':
      return `Orçamento (id ${ref}): ${item.total} · ${item.status.label}`;
    case 'pix':
      return `Pix (id ${ref}): ${item.amount} · ${item.status.label}`;
    case 'whatsapp':
      return `${item.label}: ${item.text}${item.buttons.length ? ` [${item.buttons.join(' / ')}]` : ''}`;
    case 'professional':
      return `Profissional para a equipe: ${item.text}`;
    case 'assistant':
      return `${item.assistant.name} (${item.assistant.title}): ${item.text}`;
    case 'handoff':
      return `${item.assistant.name} para ${item.to.name}: ${item.text}`;
    case 'confirmation':
      return `Cartão "${item.title}": ${decisionNames[item.status]}`;
  }
}
