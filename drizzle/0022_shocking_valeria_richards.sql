CREATE TABLE "sponsor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"paid_on" date,
	"method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor_payments" ADD CONSTRAINT "sponsor_payments_term_id_sponsorship_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."sponsorship_terms"("id") ON DELETE cascade ON UPDATE no action;