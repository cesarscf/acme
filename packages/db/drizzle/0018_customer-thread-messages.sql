ALTER TABLE "assistant_messages" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_messages_customer_id_created_at_index" ON "assistant_messages" USING btree ("customer_id","created_at");