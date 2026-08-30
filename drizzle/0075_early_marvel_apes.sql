CREATE TABLE "sepa_charge_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"remittance_id" uuid,
	"returned_on" date NOT NULL,
	"return_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sepa_charge_returns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sepa_charge_returns" ADD CONSTRAINT "sepa_charge_returns_charge_id_sepa_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."sepa_charges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_charge_returns" ADD CONSTRAINT "sepa_charge_returns_remittance_id_sepa_remittances_id_fk" FOREIGN KEY ("remittance_id") REFERENCES "public"."sepa_remittances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sepa_charge_returns_charge_idx" ON "sepa_charge_returns" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "sepa_charges_payer_idx" ON "sepa_charges" USING btree ("payer_person_id");