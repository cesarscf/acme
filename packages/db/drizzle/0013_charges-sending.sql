ALTER TABLE "charges" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "reminded_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "reminded_at" timestamp with time zone;