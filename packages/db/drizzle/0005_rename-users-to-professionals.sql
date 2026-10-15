ALTER TABLE "users" RENAME TO "professionals";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_pkey" TO "professionals_pkey";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_email_unique" TO "professionals_email_unique";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_phoneNumber_unique" TO "professionals_phoneNumber_unique";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "user_id" TO "professional_id";--> statement-breakpoint
ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_user_id_users_id_fk" TO "sessions_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER INDEX "sessions_user_id_index" RENAME TO "sessions_professional_id_index";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "user_id" TO "professional_id";--> statement-breakpoint
ALTER TABLE "accounts" RENAME CONSTRAINT "accounts_user_id_users_id_fk" TO "accounts_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER INDEX "accounts_user_id_index" RENAME TO "accounts_professional_id_index";--> statement-breakpoint
ALTER TABLE "assistants" RENAME CONSTRAINT "assistants_professional_id_users_id_fk" TO "assistants_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "llm_usages" RENAME CONSTRAINT "llm_usages_professional_id_users_id_fk" TO "llm_usages_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_id_not_null" TO "professionals_id_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_name_not_null" TO "professionals_name_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_email_not_null" TO "professionals_email_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_email_verified_not_null" TO "professionals_email_verified_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_created_at_not_null" TO "professionals_created_at_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_updated_at_not_null" TO "professionals_updated_at_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_timezone_not_null" TO "professionals_timezone_not_null";--> statement-breakpoint
ALTER TABLE "professionals" RENAME CONSTRAINT "users_trades_not_null" TO "professionals_trades_not_null";--> statement-breakpoint
ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_user_id_not_null" TO "sessions_professional_id_not_null";--> statement-breakpoint
ALTER TABLE "accounts" RENAME CONSTRAINT "accounts_user_id_not_null" TO "accounts_professional_id_not_null";
