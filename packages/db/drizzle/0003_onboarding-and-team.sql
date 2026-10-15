CREATE TYPE "public"."assistant_role" AS ENUM('scheduling', 'quotes', 'billing');--> statement-breakpoint
CREATE TYPE "public"."playbook_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TYPE "public"."trade" AS ENUM('hvac', 'electrical', 'plumbing', 'maintenance', 'pest_control', 'cleaning', 'gardening_and_pools', 'installation', 'appliance_repair', 'other');--> statement-breakpoint
CREATE TYPE "public"."work_style" AS ENUM('solo', 'with_helper', 'with_crew');--> statement-breakpoint
CREATE TABLE "assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"role" "assistant_role" NOT NULL,
	"name" text NOT NULL,
	"playbook" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"playbook_status" "playbook_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistants_professionalId_role_unique" UNIQUE("professional_id","role")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "work_style" "work_style";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trades" "trade"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistants" ADD CONSTRAINT "assistants_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;