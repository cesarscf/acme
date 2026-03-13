import { relations } from "drizzle-orm"
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { organizations } from "./auth"

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  templateSlug: text("template_slug").notNull(),
  content: jsonb("content").notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const pagesRelations = relations(pages, ({ one }) => ({
  organization: one(organizations, {
    fields: [pages.organizationId],
    references: [organizations.id],
  }),
}))
