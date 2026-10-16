import { customers, db, priceItems, professionals, quoteItems, quotes } from '@acme/db';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { formatMoney } from '../briefing/scripts';
import { addNotice } from '../conversations/notices';
import { declineJob, openJob } from '../jobs/service';
import { addDays, localDate } from '../visits/time';
import { defineTemplate, ensureTemplate, onButtonClick, sendMessage } from '../whatsapp/service';

type Professional = { id: string; name: string; timezone: string };
type NewQuoteItem = { priceItemId: string | null; description: string; quantity: number; unitPriceCents: number };
export type QuoteWithItems = NonNullable<Awaited<ReturnType<typeof findQuote>>>;

const buttons = {
  type: 'BUTTONS',
  buttons: [
    { type: 'QUICK_REPLY', text: 'Aprovar' },
    { type: 'QUICK_REPLY', text: 'Recusar' },
  ],
} as const;

const quoteTemplate = defineTemplate({
  name: 'quote',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Olá, {{1}}! Segue o orçamento de {{2}}: {{3}}. Total: {{4}}. Válido até {{5}}.',
      example: {
        body_text: [
          [
            'Ana',
            'Carlos Elétrica',
            'Troca de tomada (R$ 80,00); 2x Instalação de luminária (R$ 120,00 cada)',
            'R$ 320,00',
            '25/10',
          ],
        ],
      },
    },
    buttons,
  ],
});

const quoteReminderTemplate = defineTemplate({
  name: 'quote_reminder',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Olá, {{1}}! Passando para lembrar do orçamento de {{2}}, no total de {{3}}, válido até {{4}}. Podemos fechar?',
      example: { body_text: [['Ana', 'Carlos Elétrica', 'R$ 320,00', '25/10']] },
    },
    buttons,
  ],
});

const buttonActions = ['approve', 'decline'] as const;

export async function ensureQuoteTemplates() {
  await ensureTemplate(env('META_PLATFORM_WABA_ID'), quoteTemplate);
  await ensureTemplate(env('META_PLATFORM_WABA_ID'), quoteReminderTemplate);
}

export function listPriceItems(professionalId: string) {
  return db
    .select()
    .from(priceItems)
    .where(eq(priceItems.professionalId, professionalId))
    .orderBy(asc(priceItems.name));
}

export function findPriceItem(professionalId: string, id: string) {
  return db.query.priceItems.findFirst({
    where: and(eq(priceItems.id, id), eq(priceItems.professionalId, professionalId)),
  });
}

// The name is how the Professional refers to a PriceItem, so the same name in any case updates the one that exists.
export async function upsertPriceItem(
  professionalId: string,
  { id, name, priceCents }: { id?: string; name: string; priceCents: number },
) {
  const existing = id
    ? await findPriceItem(professionalId, id)
    : await db.query.priceItems.findFirst({
        where: and(eq(priceItems.professionalId, professionalId), sql`lower(${priceItems.name}) = lower(${name})`),
      });
  if (existing) {
    const [updated] = await db
      .update(priceItems)
      .set({ name: id ? name : existing.name, priceCents })
      .where(eq(priceItems.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await db.insert(priceItems).values({ professionalId, name, priceCents }).returning();
  return created!;
}

export async function createQuote(professionalId: string, customerId: string, items: NewQuoteItem[]) {
  const totalCents = items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
  return db.transaction(async (tx) => {
    // Outside a Job, the Quote opens one named after what it prices.
    const jobId = await openJob(professionalId, customerId, items[0]!.description, tx);
    const [quote] = await tx.insert(quotes).values({ professionalId, customerId, jobId, totalCents }).returning();
    await tx.insert(quoteItems).values(items.map((item, position) => ({ ...item, quoteId: quote!.id, position })));
    return quote!.id;
  });
}

export async function findQuote(professionalId: string, id: string) {
  const [quote] = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      totalCents: quotes.totalCents,
      sentAt: quotes.sentAt,
      validUntil: quotes.validUntil,
      customer: { id: customers.id, name: customers.name, phoneNumber: customers.phoneNumber },
    })
    .from(quotes)
    .innerJoin(customers, eq(customers.id, quotes.customerId))
    .where(and(eq(quotes.id, id), eq(quotes.professionalId, professionalId)));
  if (!quote) return undefined;
  const items = await db
    .select({
      description: quoteItems.description,
      quantity: quoteItems.quantity,
      unitPriceCents: quoteItems.unitPriceCents,
    })
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id))
    .orderBy(asc(quoteItems.position));
  return { ...quote, items };
}

export function describeItem({ description, quantity, unitPriceCents }: QuoteWithItems['items'][number]) {
  const price = formatMoney(unitPriceCents);
  return quantity === 1 ? `${description} (${price})` : `${quantity}x ${description} (${price} cada)`;
}

export function formatDate(date: string) {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

// Sending again starts the validity over and allows one more follow-up.
export async function sendQuote(quote: QuoteWithItems, professional: Professional, validityDays: number) {
  const validUntil = addDays(localDate(new Date(), professional.timezone), validityDays);
  // ADR 0003: the Customer channel is the Professional's own number, connected in ticket 18; M1 sends from the platform's.
  await sendTemplate(quoteTemplate.name, quote, [
    quote.customer.name,
    professional.name,
    // Meta refuses line breaks inside a template parameter, so the items go on one line.
    quote.items.map(describeItem).join('; '),
    formatMoney(quote.totalCents),
    formatDate(validUntil),
  ]);
  await db
    .update(quotes)
    .set({ status: 'sent', sentAt: new Date(), validUntil, followedUpAt: null })
    .where(eq(quotes.id, quote.id));
  return validUntil;
}

export async function followUpDueQuotes(
  professional: Professional,
  { action, afterDays }: { action: 'remind' | 'notify_me'; afterDays: number },
  now: Date,
) {
  const due = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(
      and(
        eq(quotes.professionalId, professional.id),
        eq(quotes.status, 'sent'),
        isNull(quotes.followedUpAt),
        lte(quotes.sentAt, new Date(now.getTime() - afterDays * 86_400_000)),
        gte(quotes.validUntil, localDate(now, professional.timezone)),
      ),
    );
  for (const { id } of due) {
    // Claimed before sending, so a retry overlapping the next run cannot remind the same Customer twice.
    const [claimed] = await db
      .update(quotes)
      .set({ followedUpAt: new Date() })
      .where(and(eq(quotes.id, id), isNull(quotes.followedUpAt)))
      .returning({ id: quotes.id });
    if (!claimed) continue;
    const quote = (await findQuote(professional.id, id))!;
    const total = formatMoney(quote.totalCents);
    let text: string;
    if (action === 'remind') {
      try {
        await sendTemplate(quoteReminderTemplate.name, quote, [
          quote.customer.name,
          professional.name,
          total,
          formatDate(quote.validUntil!),
        ]);
      } catch (error) {
        await db.update(quotes).set({ followedUpAt: null }).where(eq(quotes.id, id));
        throw error;
      }
      text = `Rotina: lembrei ${quote.customer.name} do orçamento de ${total}.`;
    } else {
      text = `${quote.customer.name} ainda não respondeu o orçamento de ${total}. Quer que eu mande de novo?`;
    }
    await db.transaction((tx) => addNotice(tx, professional.id, 'quotes', text));
  }
}

async function sendTemplate(name: string, quote: QuoteWithItems, body: string[]) {
  await sendMessage({
    from: env('META_PLATFORM_PHONE_NUMBER_ID'),
    to: quote.customer.phoneNumber,
    message: {
      type: 'template',
      template: {
        name,
        language: { code: 'pt_BR' },
        components: [
          { type: 'body', parameters: body.map((text) => ({ type: 'text' as const, text })) },
          ...buttonActions.map((action, index) => ({
            type: 'button' as const,
            sub_type: 'quick_reply' as const,
            index: String(index),
            parameters: [{ type: 'payload' as const, payload: action }],
          })),
        ],
      },
    },
    origin: { type: 'quote', id: quote.id },
  });
}

onButtonClick('quote', async ({ originId, button, tx }) => {
  const [quote] = await tx
    .select({
      id: quotes.id,
      jobId: quotes.jobId,
      status: quotes.status,
      totalCents: quotes.totalCents,
      validUntil: quotes.validUntil,
      professionalId: quotes.professionalId,
      timezone: professionals.timezone,
      customerId: customers.id,
      customerName: customers.name,
    })
    .from(quotes)
    .innerJoin(customers, eq(customers.id, quotes.customerId))
    .innerJoin(professionals, eq(professionals.id, quotes.professionalId))
    .where(eq(quotes.id, originId))
    // Two quick taps (Aprovar, then Recusar) are answered one after the other, so the second sees the first.
    .for('update', { of: quotes });
  const action = buttonActions.find((action) => action === button.payload);
  if (!quote || !action || !quote.validUntil) return;
  const total = formatMoney(quote.totalCents);

  let text: string;
  if (quote.status === 'approved' || quote.status === 'declined') {
    const answered = quote.status === 'approved' ? 'aprovado' : 'recusado';
    text = `${quote.customerName} tocou em ${button.text} no orçamento de ${total}, mas ele já estava ${answered}. Nada mudou.`;
  } else if (localDate(new Date(), quote.timezone) > quote.validUntil) {
    text = `${quote.customerName} tocou em ${button.text} no orçamento de ${total}, mas ele venceu em ${formatDate(quote.validUntil)}. Nada mudou.`;
  } else {
    const status = action === 'approve' ? 'approved' : 'declined';
    await tx.update(quotes).set({ status }).where(eq(quotes.id, quote.id));
    text = `${quote.customerName} ${action === 'approve' ? 'aprovou' : 'recusou'} o orçamento de ${total}.`;
    // An approved Quote is the scheduling Assistant's cue to offer booking the Visit.
    if (status === 'approved') {
      await addNotice(tx, quote.professionalId, 'scheduling', text, {
        suggestion: 'book_visit',
        customerId: quote.customerId,
      });
    } else await declineJob(quote.jobId, tx);
  }

  await addNotice(tx, quote.professionalId, 'quotes', text);
});

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
