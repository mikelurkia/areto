CREATE TABLE "sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_name" text NOT NULL,
	"contact_person_id" uuid,
	"contact_email" text,
	"contact_phone" text,
	"amount_cents" integer,
	"starts_on" date,
	"ends_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_contact_person_id_persons_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;