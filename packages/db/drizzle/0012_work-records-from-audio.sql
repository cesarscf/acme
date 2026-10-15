ALTER TABLE "work_records" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_records" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_records" ALTER COLUMN "amount_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_records" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "work_records" ADD COLUMN "cash_received" boolean;--> statement-breakpoint
ALTER TABLE "work_records" ADD COLUMN "transcript" text DEFAULT '' NOT NULL;