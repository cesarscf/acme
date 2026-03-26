import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const organizationInvitations = pgTable("organization_invitations", {
	id: text().primaryKey(),
	email: text().notNull(),
	inviterId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	organizationId: text()
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	role: text().notNull().default("member"),
	status: text().notNull().default("pending"),
	createdAt: timestamp().notNull().defaultNow(),
	expiresAt: timestamp().notNull(),
});
