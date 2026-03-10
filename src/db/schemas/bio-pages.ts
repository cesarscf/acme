import { relations } from "drizzle-orm"
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { links } from "./links"
import { tenants } from "./tenants"

export const bioPages = pgTable("bio_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const bioPagesRelations = relations(bioPages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bioPages.tenantId],
    references: [tenants.id],
  }),
  links: many(links),
}))
