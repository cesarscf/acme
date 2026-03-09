ALTER TABLE "landing_pages" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "link_pages" ADD COLUMN "active" boolean DEFAULT true NOT NULL;