ALTER TYPE "public"."charge_status" ADD VALUE 'cancelled';--> statement-breakpoint
DROP INDEX "charges_work_record_id_index";--> statement-breakpoint
-- A race could have made two Charges for one WorkRecord and PaymentMethod; the paid one, then the sent one, then the oldest stays.
DELETE FROM "charges" WHERE "id" IN (SELECT "id" FROM (SELECT "id", row_number() OVER (PARTITION BY "work_record_id", "payment_method" ORDER BY "status" = 'paid' DESC, "sent_at" IS NOT NULL DESC, "created_at") AS "rank" FROM "charges") AS "ranked" WHERE "rank" > 1);--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_workRecordId_paymentMethod_unique" UNIQUE("work_record_id","payment_method");