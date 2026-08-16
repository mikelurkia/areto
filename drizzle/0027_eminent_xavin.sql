CREATE TABLE "club_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"address" text,
	"email" text,
	"phone" text,
	"iban" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
