import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const whatsappMessageDirection = pgEnum('whatsapp_message_direction', ['outbound', 'inbound']);

// Declared in delivery order: the API only moves a status forward by comparing enum values.
export const whatsappMessageStatus = pgEnum('whatsapp_message_status', ['sent', 'delivered', 'read', 'failed']);

export const whatsappOriginType = pgEnum('whatsapp_origin_type', ['quote', 'visit', 'charge']);

export const whatsappMessages = pgTable(
  'whatsapp_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    wamid: text().notNull().unique(),
    direction: whatsappMessageDirection().notNull(),
    phoneNumberId: text().notNull(),
    waId: text().notNull(),
    type: text().notNull(),
    text: text(),
    payload: jsonb().notNull(),
    contextWamid: text(),
    originType: whatsappOriginType(),
    originId: uuid(),
    status: whatsappMessageStatus(),
    errors: jsonb(),
    sentAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.phoneNumberId, table.waId, table.sentAt)],
);

export const workStyle = pgEnum('work_style', ['solo', 'with_helper', 'with_crew']);

export const trade = pgEnum('trade', [
  'hvac',
  'electrical',
  'plumbing',
  'maintenance',
  'pest_control',
  'cleaning',
  'gardening_and_pools',
  'installation',
  'appliance_repair',
  'other',
]);

// Better Auth tables (`npx auth generate`); its user model is the Professional (`modelName` in the auth config).
export const professionals = pgTable('professionals', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  phoneNumber: text().unique(),
  phoneNumberVerified: boolean(),
  timezone: text().notNull().default('America/Sao_Paulo'),
  workStyle: workStyle(),
  trades: trade().array().notNull().default([]),
  aiConsentedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.identifier)],
);

// Only the Roles that exist; the ones marked "em breve" live in the Catalog alone (ADR 0007).
export const assistantRole = pgEnum('assistant_role', ['scheduling', 'quotes', 'billing']);

export const playbookStatus = pgEnum('playbook_status', ['draft', 'approved']);

export const assistants = pgTable(
  'assistants',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    role: assistantRole().notNull(),
    name: text().notNull(),
    playbook: jsonb().notNull().default({}),
    playbookStatus: playbookStatus().notNull().default('draft'),
    // What the Professional said at each Briefing step, kept apart so the Playbook holds only its fields.
    briefing: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.professionalId, table.role)],
);

export const assistantMessageRole = pgEnum('assistant_message_role', ['user', 'assistant']);

// One row per Messages API turn, content kept as the API sent it so the history replays unchanged.
export const assistantMessages = pgTable(
  'assistant_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    assistantId: uuid()
      .notNull()
      .references(() => assistants.id, { onDelete: 'cascade' }),
    role: assistantMessageRole().notNull(),
    content: jsonb().notNull(),
    // Set when the turn happened in a Customer's thread, which keeps its own history apart from the Assistant's chat.
    customerId: uuid().references((): AnyPgColumn => customers.id, { onDelete: 'cascade' }),
    jobId: uuid().references((): AnyPgColumn => jobs.id, { onDelete: 'set null' }),
    // clock_timestamp, not now(): rows written in one transaction must keep their order.
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (table) => [index().on(table.assistantId, table.createdAt), index().on(table.customerId, table.createdAt)],
);

export const toolConfirmationStatus = pgEnum('tool_confirmation_status', ['pending', 'confirmed', 'cancelled']);

export const toolConfirmations = pgTable('tool_confirmations', {
  id: uuid().primaryKey().defaultRandom(),
  assistantId: uuid()
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  messageId: uuid()
    .notNull()
    .references(() => assistantMessages.id, { onDelete: 'cascade' }),
  toolUseId: text().notNull().unique(),
  status: toolConfirmationStatus().notNull().default('pending'),
  decidedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// A turn running in some API process; expiresAt is renewed while it runs, so a dead process frees it.
export const runningTurns = pgTable('running_turns', {
  id: uuid().primaryKey().defaultRandom(),
  // Null while the Customer's thread is held but the team has not picked who answers.
  assistantId: uuid()
    .unique()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  customerId: uuid()
    .unique()
    .references(() => customers.id, { onDelete: 'cascade' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

export const llmUsages = pgTable(
  'llm_usages',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    assistantId: uuid().references(() => assistants.id, { onDelete: 'set null' }),
    model: text().notNull(),
    inputTokens: integer().notNull(),
    outputTokens: integer().notNull(),
    cacheCreationInputTokens: integer().notNull(),
    cacheReadInputTokens: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.professionalId, table.createdAt)],
);

export const audioUsages = pgTable(
  'audio_usages',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    assistantId: uuid().references(() => assistants.id, { onDelete: 'set null' }),
    model: text().notNull(),
    seconds: doublePrecision().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.professionalId, table.createdAt)],
);

export const noticeSuggestion = pgEnum('notice_suggestion', ['book_visit']);
export const suggestionAnswer = pgEnum('suggestion_answer', ['accepted', 'dismissed']);

// App-side notices in an Assistant's conversation (a Customer tapped a button); Claude reads them with the next message.
export const assistantNotices = pgTable(
  'assistant_notices',
  {
    id: uuid().primaryKey().defaultRandom(),
    assistantId: uuid()
      .notNull()
      .references(() => assistants.id, { onDelete: 'cascade' }),
    text: text().notNull(),
    // A next step offered with the notice, done only when the Professional taps it (a handoff between Assistants).
    suggestion: noticeSuggestion(),
    customerId: uuid().references(() => customers.id, { onDelete: 'cascade' }),
    suggestionAnswer: suggestionAnswer(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (table) => [index().on(table.assistantId, table.createdAt)],
);

// The phone number is the Customer's identity in M1; Meta's BSUID joins it in M2.
export const customers = pgTable(
  'customers',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    phoneNumber: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.professionalId, table.phoneNumber)],
);

export const jobStatus = pgEnum('job_status', ['open', 'done', 'declined']);

// A Customer's case from the request to the payment; its Visits, Quotes and WorkRecords point at it.
export const jobs = pgTable(
  'jobs',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    status: jobStatus().notNull().default('open'),
    openedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index().on(table.professionalId, table.customerId),
    // The MVP keeps one open Job per Customer: a new request goes into it.
    uniqueIndex('jobs_one_open_per_customer').on(table.customerId).where(sql`${table.status} = 'open'`),
  ],
);

export const visitStatus = pgEnum('visit_status', ['scheduled', 'confirmed', 'reschedule_requested', 'cancelled']);

export const visits = pgTable(
  'visits',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp({ withTimezone: true }).notNull(),
    durationMinutes: integer().notNull(),
    status: visitStatus().notNull().default('scheduled'),
    // The scheduledAt the Customer was last asked to confirm, so a Routine retry does not ask again.
    confirmationRequestedFor: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId, table.scheduledAt)],
);

export const priceItems = pgTable(
  'price_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    priceCents: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId)],
);

export const quoteStatus = pgEnum('quote_status', ['draft', 'sent', 'approved', 'declined']);

export const quotes = pgTable(
  'quotes',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: quoteStatus().notNull().default('draft'),
    totalCents: integer().notNull(),
    sentAt: timestamp({ withTimezone: true }),
    // The last day the Customer can approve, in the Professional's time zone.
    validUntil: date(),
    // When the follow-up Routine reminded the Customer (or told the Professional), so it happens once per send.
    followedUpAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId, table.status)],
);

export const quoteItems = pgTable(
  'quote_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    quoteId: uuid()
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    priceItemId: uuid().references(() => priceItems.id, { onDelete: 'set null' }),
    // Copied from the PriceItem, so a later price change does not alter a Quote already made.
    description: text().notNull(),
    quantity: integer().notNull(),
    unitPriceCents: integer().notNull(),
    position: integer().notNull(),
  },
  (table) => [index().on(table.quoteId)],
);

export const paymentMethod = pgEnum('payment_method', ['pix', 'cash']);

export const workRecords = pgTable(
  'work_records',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    // Saved straight from the audio: what Claude could not tell stays null and is asked in the service thread.
    customerId: uuid().references(() => customers.id, { onDelete: 'cascade' }),
    visitId: uuid().references(() => visits.id, { onDelete: 'set null' }),
    // Known once the Customer is: the Visit's Job, or the Customer's open one.
    jobId: uuid().references(() => jobs.id, { onDelete: 'cascade' }),
    title: text(),
    description: text(),
    materials: text(),
    amountCents: integer(),
    // How the Customer pays; the Charge, when there is one, carries the same PaymentMethod.
    paymentMethod: paymentMethod().notNull(),
    // Cash only: whether the Customer already paid, which makes the Charge paid on the spot.
    cashReceived: boolean(),
    // What the Professional said: the audio's transcript, then each message in the service thread, one per line.
    transcript: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId, table.createdAt)],
);

// cancelled: a Pix Charge left behind when the Customer paid the WorkRecord another way.
export const chargeStatus = pgEnum('charge_status', ['pending', 'awaiting_confirmation', 'paid', 'cancelled']);

export const charges = pgTable(
  'charges',
  {
    id: uuid().primaryKey().defaultRandom(),
    professionalId: uuid()
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    workRecordId: uuid()
      .notNull()
      .references(() => workRecords.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    amountCents: integer().notNull(),
    paymentMethod: paymentMethod().notNull(),
    status: chargeStatus().notNull().default('pending'),
    sentAt: timestamp({ withTimezone: true }),
    // How many times the reminder Routine reminded the Customer since the last send, and when it last did.
    remindedCount: integer().notNull().default(0),
    remindedAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index().on(table.professionalId, table.status), unique().on(table.workRecordId, table.paymentMethod)],
);
