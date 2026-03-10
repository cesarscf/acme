import { relations } from "drizzle-orm"
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { bioPages } from "./bio-pages"

export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  bioPageId: uuid("bio_page_id")
    .notNull()
    .references(() => bioPages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const linksRelations = relations(links, ({ one }) => ({
  bioPage: one(bioPages, {
    fields: [links.bioPageId],
    references: [bioPages.id],
  }),
}))
