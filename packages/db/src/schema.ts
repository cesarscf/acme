import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
