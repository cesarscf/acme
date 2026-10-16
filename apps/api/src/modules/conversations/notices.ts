import { assistantMessages, assistantNotices, assistants, customers, db } from '@acme/db';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { AssistantRole } from '../team/catalog';
import { roles } from '../team/roles';
import type { ConversationItem, TimedItems } from './history';
import type { Assistant } from './service';

// A notice about one Customer shows in their thread too, and in the Assistant's chat as an activity card linking there.
type About = { customerId: string; suggestion?: 'book_visit' };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Notices go to the Professional's Assistant with that Role; without one, nobody is there to tell.
export async function addNotice(
  tx: Transaction,
  professionalId: string,
  role: AssistantRole,
  text: string,
  about?: About,
) {
  const [assistant] = await tx
    .select({ id: assistants.id })
    .from(assistants)
    .where(and(eq(assistants.professionalId, professionalId), eq(assistants.role, role)));
  if (assistant) await tx.insert(assistantNotices).values({ assistantId: assistant.id, text, ...about });
}

export function loadNotices(assistantId: string) {
  return db
    .select()
    .from(assistantNotices)
    .where(eq(assistantNotices.assistantId, assistantId))
    .orderBy(asc(assistantNotices.createdAt));
}

// What the Assistant's chat shows besides the messages: notices, their suggestions and what the Role adds.
export async function loadTimedItems(assistant: Assistant) {
  const { suggestion: suggestionText, timeline } = roles[assistant.role];
  const notices = await db
    .select({
      id: assistantNotices.id,
      text: assistantNotices.text,
      createdAt: assistantNotices.createdAt,
      suggestion: assistantNotices.suggestion,
      suggestionAnswer: assistantNotices.suggestionAnswer,
      customerId: assistantNotices.customerId,
      customerName: customers.name,
    })
    .from(assistantNotices)
    .leftJoin(customers, eq(customers.id, assistantNotices.customerId))
    .where(eq(assistantNotices.assistantId, assistant.id))
    .orderBy(asc(assistantNotices.createdAt));
  const timed: TimedItems[] = notices.map(
    ({ id, text, createdAt, suggestion, suggestionAnswer, customerId, customerName }) => {
      if (customerId && customerName && !suggestion) {
        const customer = { id: customerId, name: customerName };
        return { at: createdAt, jobId: null, items: [activity(customer, `notice:${id}`, text, createdAt)] };
      }
      const items: ConversationItem[] = [{ id, type: 'notice', text }];
      if (suggestion && customerName && suggestionText) {
        items.push({
          id,
          type: 'suggestion',
          action: suggestion,
          question: suggestionText.question(customerName),
          message: suggestionText.message(customerName),
          answer: suggestionAnswer,
        });
      }
      return { at: createdAt, jobId: null, items };
    },
  );
  if (timeline) timed.push(...(await timeline(assistant)));
  timed.push(...(await threadActivity(assistant.id)));
  return timed.sort((a, b) => a.at.getTime() - b.at.getTime());
}

// What the Assistant said in Customers' threads, read from the messages themselves; the card links to each one.
async function threadActivity(assistantId: string): Promise<TimedItems[]> {
  const said = await db
    .select({
      id: assistantMessages.id,
      content: assistantMessages.content,
      createdAt: assistantMessages.createdAt,
      customer: { id: customers.id, name: customers.name },
    })
    .from(assistantMessages)
    .innerJoin(customers, eq(customers.id, assistantMessages.customerId))
    .where(and(eq(assistantMessages.assistantId, assistantId), eq(assistantMessages.role, 'assistant')))
    .orderBy(asc(assistantMessages.createdAt));
  return said.flatMap(({ id, content, createdAt, customer }) => {
    const text = (content as { type: string; text?: string }[])
      .flatMap((block) => (block.type === 'text' && block.text ? [block.text] : []))
      .join('\n\n')
      .trim();
    return text ? [{ at: createdAt, jobId: null, items: [activity(customer, id, text, createdAt)] }] : [];
  });
}

function activity(customer: { id: string; name: string }, itemId: string, text: string, at: Date): ConversationItem {
  return { id: `activity:${itemId}`, type: 'activity', customer, itemId, text, at };
}

export async function findOpenSuggestion(assistantId: string, id: string) {
  const [suggestion] = await db
    .select({ id: assistantNotices.id, customerName: customers.name })
    .from(assistantNotices)
    .innerJoin(customers, eq(customers.id, assistantNotices.customerId))
    .where(
      and(
        eq(assistantNotices.id, id),
        eq(assistantNotices.assistantId, assistantId),
        isNotNull(assistantNotices.suggestion),
        isNull(assistantNotices.suggestionAnswer),
      ),
    );
  return suggestion;
}
