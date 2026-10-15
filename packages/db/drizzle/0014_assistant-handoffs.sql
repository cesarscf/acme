CREATE TYPE "public"."notice_suggestion" AS ENUM('book_visit');--> statement-breakpoint
CREATE TYPE "public"."suggestion_answer" AS ENUM('accepted', 'dismissed');--> statement-breakpoint
ALTER TABLE "assistant_notices" ADD COLUMN "suggestion" "notice_suggestion";--> statement-breakpoint
ALTER TABLE "assistant_notices" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_notices" ADD COLUMN "suggestion_answer" "suggestion_answer";--> statement-breakpoint
ALTER TABLE "assistant_notices" ADD CONSTRAINT "assistant_notices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;