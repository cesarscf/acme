import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

// Better Auth tables (`npx auth generate`); a user is a Professional.
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  phoneNumber: text().unique(),
  phoneNumberVerified: boolean(),
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
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
  (table) => [index().on(table.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
  (table) => [index().on(table.userId)],
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
