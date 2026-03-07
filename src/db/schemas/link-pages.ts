import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { links } from "./links"
import { tenants } from "./tenants"

export const linkPages = pgTable("link_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const linkPagesRelations = relations(linkPages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [linkPages.tenantId],
    references: [tenants.id],
  }),
  links: many(links),
}))
