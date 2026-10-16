CREATE TABLE "running_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid,
	"customer_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "running_turns_assistantId_unique" UNIQUE("assistant_id"),
	CONSTRAINT "running_turns_customerId_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
ALTER TABLE "running_turns" ADD CONSTRAINT "running_turns_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "running_turns" ADD CONSTRAINT "running_turns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;