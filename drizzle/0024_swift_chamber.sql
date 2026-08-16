CREATE TYPE "public"."sponsorship_agreement_status" AS ENUM('negotiating', 'confirmed', 'lost');--> statement-breakpoint
CREATE TABLE "sponsor_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor_payments" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "sponsor_payments" ADD COLUMN "invoiced_on" date;--> statement-breakpoint
ALTER TABLE "sponsorship_terms" ADD COLUMN "agreement_status" "sponsorship_agreement_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_contacts" ADD CONSTRAINT "sponsor_contacts_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_notes" ADD CONSTRAINT "sponsor_notes_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;