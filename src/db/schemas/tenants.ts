import { relations } from "drizzle-orm"
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { landingPages } from "./landing-pages"
import { linkPages } from "./link-pages"
import { offers } from "./offers"

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  subdomain: text("subdomain").unique(),
  customDomain: text("custom_domain").unique(),
  domainVerified: boolean("domain_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const tenantsRelations = relations(tenants, ({ many }) => ({
  landingPages: many(landingPages),
  linkPages: many(linkPages),
  offers: many(offers),
}))
