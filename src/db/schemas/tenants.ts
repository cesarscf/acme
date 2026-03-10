import { relations } from "drizzle-orm"
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { bioPages } from "./bio-pages"
import { landingPages } from "./landing-pages"
import { offerPages } from "./offer-pages"

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  customDomain: text("custom_domain").unique(),
  domainVerified: boolean("domain_verified").notNull().default(false),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id],
  }),
  landingPages: many(landingPages),
  bioPages: many(bioPages),
  offerPages: many(offerPages),
}))
