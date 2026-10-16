import { customers, db, jobs, professionals, quotes, visits, workRecords } from '@acme/db';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { and, asc, eq, gte, inArray, lt, ne, notExists } from 'drizzle-orm';
import * as z from 'zod';
import { claude, modelParams, recordUsage } from '../conversations/claude';
import { addDays, daysAgo, localDate, localTime, shortDay, toInstant } from '../time/time';
import { listCustomerOptions } from './service';

type Professional = { id: string; timezone: string };
type Choice = Awaited<ReturnType<typeof listTellableVisits>>[number];

const system = `Um profissional que atende na casa ou na empresa dos clientes gravou um áudio contando o que fez numa visita, e o áudio foi transcrito. Diga de qual visita da lista é o relato: pelo cliente que ele citou, pelo serviço ou pelo horário. Responda com a referência (V1, V2…). Se ele fala de um cliente que não está na lista, ou não dá para saber, responda null.`;

const schema = z.strictObject({ visit: z.string().nullable() });

// The Visits the Professional can tell now: today's, and the next one of a Job whose Quote was approved; none told yet.
async function listTellableVisits({ id: professionalId, timezone }: Professional) {
  const today = localDate(new Date(), timezone);
  const startOfToday = toInstant(today, '00:00', timezone);
  const untold = notExists(db.select().from(workRecords).where(eq(workRecords.visitId, visits.id)));
  const columns = {
    id: visits.id,
    jobId: visits.jobId,
    scheduledAt: visits.scheduledAt,
    createdAt: visits.createdAt,
    title: jobs.title,
    customerName: customers.name,
  };
  const open = and(
    eq(visits.professionalId, professionalId),
    ne(visits.status, 'cancelled'),
    eq(jobs.status, 'open'),
    untold,
  );
  const todays = await db
    .select(columns)
    .from(visits)
    .innerJoin(jobs, eq(jobs.id, visits.jobId))
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .where(
      and(
        open,
        gte(visits.scheduledAt, startOfToday),
        lt(visits.scheduledAt, toInstant(addDays(today, 1), '00:00', timezone)),
      ),
    );
  const approved = await db
    .select({ jobId: quotes.jobId, sentAt: quotes.sentAt })
    .from(quotes)
    .innerJoin(jobs, eq(jobs.id, quotes.jobId))
    .where(and(eq(quotes.professionalId, professionalId), eq(quotes.status, 'approved'), eq(jobs.status, 'open')));
  const upcoming = approved.length
    ? await db
        .select(columns)
        .from(visits)
        .innerJoin(jobs, eq(jobs.id, visits.jobId))
        .innerJoin(customers, eq(customers.id, visits.customerId))
        .where(
          and(
            open,
            inArray(
              visits.jobId,
              approved.map(({ jobId }) => jobId),
            ),
            gte(visits.scheduledAt, startOfToday),
          ),
        )
        .orderBy(asc(visits.scheduledAt))
    : [];
  // The execution is the Visit booked after the Quote went out; only the next one is told.
  const executions = approved.flatMap(({ jobId, sentAt }) => {
    const next = upcoming.find((visit) => visit.jobId === jobId && sentAt && visit.createdAt > sentAt);
    return next ? [next] : [];
  });
  const unique = new Map([...todays, ...executions].map((visit) => [visit.id, visit]));
  return [...unique.values()].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

// "hoje, 08:00", "amanhã, 08:00" or "qui, 19 out, 08:00".
function when(instant: Date, timeZone: string) {
  const days = daysAgo(instant, timeZone);
  const day =
    days === 0 ? 'hoje' : days === -1 ? 'amanhã' : days === 1 ? 'ontem' : shortDay(instant, timeZone).toLowerCase();
  return `${day}, ${localTime(instant, timeZone)}`;
}

// Which Visit the account is about. Nothing is saved: the Professional confirms it or picks another.
export async function matchVisit(
  professionalId: string,
  assistantId: string | null,
  transcript: string,
  visitId?: string,
) {
  const [professional] = await db
    .select({ id: professionals.id, timezone: professionals.timezone })
    .from(professionals)
    .where(eq(professionals.id, professionalId));
  if (!professional) return undefined;
  const choices = await listTellableVisits(professional);
  const describe = (visit: Choice) => ({
    visitId: visit.id,
    customerName: visit.customerName,
    detail: `${visit.title} · ${when(visit.scheduledAt, professional.timezone)}`,
  });
  let suggested: Choice | undefined;
  if (visitId) {
    [suggested] = await db
      .select({
        id: visits.id,
        jobId: visits.jobId,
        scheduledAt: visits.scheduledAt,
        createdAt: visits.createdAt,
        title: jobs.title,
        customerName: customers.name,
      })
      .from(visits)
      .innerJoin(jobs, eq(jobs.id, visits.jobId))
      .innerJoin(customers, eq(customers.id, visits.customerId))
      .where(and(eq(visits.id, visitId), eq(visits.professionalId, professional.id)));
    if (!suggested) return undefined;
  } else if (choices.length) {
    suggested = await pick(professional, assistantId, choices, transcript);
  }
  return {
    suggested: suggested
      ? {
          visitId: suggested.id,
          customerName: suggested.customerName,
          question: `Pelo que você contou, é do ${suggested.customerName}?`,
          detail: `Vai para a visita de ${when(suggested.scheduledAt, professional.timezone)} · ${suggested.title}`,
        }
      : null,
    others: choices.filter(({ id }) => id !== suggested?.id).map(describe),
    // For "Outro cliente": who the account is most likely for when it is not about a Visit.
    customers: await listCustomerOptions(professionalId),
  };
}

async function pick(professional: Professional, assistantId: string | null, choices: Choice[], transcript: string) {
  const refs = new Map(choices.map((visit, index) => [`V${index + 1}`, visit]));
  const list = [...refs]
    .map(
      ([ref, visit]) =>
        `- ${ref}: ${visit.customerName}, ${visit.title} · ${when(visit.scheduledAt, professional.timezone)}`,
    )
    .join('\n');
  const format = betaZodOutputFormat(schema);
  const message = await claude().beta.messages.create({
    ...modelParams(),
    max_tokens: 200,
    output_config: { effort: 'low', format },
    system,
    messages: [{ role: 'user', content: `Visitas:\n${list}\n\n<relato>${transcript}</relato>` }],
  });
  await recordUsage({ id: assistantId, professional: { id: professional.id } }, message);
  const output = message.content.find((block) => block.type === 'text')?.text;
  if (message.stop_reason !== 'end_turn' || !output) return undefined;
  try {
    const { visit } = format.parse(output);
    return visit ? refs.get(visit) : undefined;
  } catch (error) {
    if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError) return undefined;
    throw error;
  }
}
