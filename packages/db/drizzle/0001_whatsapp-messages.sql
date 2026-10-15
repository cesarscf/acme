CREATE TYPE "public"."whatsapp_message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_status" AS ENUM('sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_origin_type" AS ENUM('quote', 'visit', 'charge');--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wamid" text NOT NULL,
	"direction" "whatsapp_message_direction" NOT NULL,
	"phone_number_id" text NOT NULL,
	"wa_id" text NOT NULL,
	"type" text NOT NULL,
	"text" text,
	"payload" jsonb NOT NULL,
	"context_wamid" text,
	"origin_type" "whatsapp_origin_type",
	"origin_id" uuid,
	"status" "whatsapp_message_status",
	"errors" jsonb,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_wamid_unique" UNIQUE("wamid")
);
--> statement-breakpoint
CREATE INDEX "whatsapp_messages_phone_number_id_wa_id_sent_at_index" ON "whatsapp_messages" USING btree ("phone_number_id","wa_id","sent_at");