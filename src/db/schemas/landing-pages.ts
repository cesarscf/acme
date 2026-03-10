import { relations } from "drizzle-orm"
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { tenants } from "./tenants"

export const landingPages = pgTable("landing_pages", {
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

export const landingPagesRelations = relations(landingPages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [landingPages.tenantId],
    references: [tenants.id],
  }),
}))
