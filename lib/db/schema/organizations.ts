import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
	id: text().primaryKey(),
	name: text().notNull(),
	slug: text().notNull().unique(),
	logo: text(),
	metadata: text(),
	customDomain: text(),
	createdAt: timestamp().notNull().defaultNow(),
});
