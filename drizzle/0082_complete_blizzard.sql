CREATE TYPE "public"."invoice_source" AS ENUM('manual', 'extracted');--> statement-breakpoint
CREATE TYPE "public"."received_invoice_status" AS ENUM('pending', 'paid', 'disputed');--> statement-breakpoint
CREATE TABLE "movement_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_invoice_id" uuid,
	"issued_invoice_id" uuid,
	"sepa_remittance_id" uuid,
	"sponsor_payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movement_links_target_xor" CHECK ((
        (case when "movement_links"."received_invoice_id" is not null then 1 else 0 end) +
        (case when "movement_links"."issued_invoice_id" is not null then 1 else 0 end) +
        (case when "movement_links"."sepa_remittance_id" is not null then 1 else 0 end) +
        (case when "movement_links"."sponsor_payment_id" is not null then 1 else 0 end)
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "movement_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "received_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"ledger" "ledger" DEFAULT 'official' NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid,
	"invoice_number" text NOT NULL,
	"issued_on" date NOT NULL,
	"due_date" date,
	"category_id" uuid,
	"description" text,
	"base_cents" integer NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"withholding_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "received_invoice_status" DEFAULT 'pending' NOT NULL,
	"source" "invoice_source" DEFAULT 'manual' NOT NULL,
	"file_path" text,
	"file_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "received_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"iban" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"default_category_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_movement_id_account_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."account_movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_received_invoice_id_received_invoices_id_fk" FOREIGN KEY ("received_invoice_id") REFERENCES "public"."received_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_sepa_remittance_id_sepa_remittances_id_fk" FOREIGN KEY ("sepa_remittance_id") REFERENCES "public"."sepa_remittances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_sponsor_payment_id_sponsor_payments_id_fk" FOREIGN KEY ("sponsor_payment_id") REFERENCES "public"."sponsor_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_category_id_economic_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."economic_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_default_category_id_economic_categories_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."economic_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movement_links_movement_idx" ON "movement_links" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX "movement_links_received_invoice_idx" ON "movement_links" USING btree ("received_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "received_invoices_supplier_number_idx" ON "received_invoices" USING btree ("supplier_id","invoice_number");--> statement-breakpoint
CREATE INDEX "received_invoices_season_idx" ON "received_invoices" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_tax_id_idx" ON "suppliers" USING btree ("tax_id") WHERE "suppliers"."tax_id" is not null;