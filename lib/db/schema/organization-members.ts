import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const organizationMembers = pgTable("organization_members", {
	id: text().primaryKey(),
	userId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	organizationId: text()
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	role: text().notNull().default("member"),
	createdAt: timestamp().notNull().defaultNow(),
});
