CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_person_id" uuid,
	"contact_email" text,
	"contact_phone" text,
	"logo_path" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsorship_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"tier" "sponsorship_tier",
	"amount_cents" integer,
	"starts_on" date,
	"ends_on" date,
	"benefits" text,
	"contract_path" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_contact_person_id_persons_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_terms" ADD CONSTRAINT "sponsorship_terms_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;