CREATE TABLE "purchase_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger" "ledger" DEFAULT 'official' NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid,
	"category_id" uuid,
	"paid_by_person_id" uuid,
	"purchased_on" date NOT NULL,
	"description" text NOT NULL,
	"total_cents" integer NOT NULL,
	"file_path" text,
	"file_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movement_links" DROP CONSTRAINT "movement_links_target_xor";--> statement-breakpoint
ALTER TABLE "movement_links" ADD COLUMN "purchase_receipt_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_category_id_economic_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."economic_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_paid_by_person_id_persons_id_fk" FOREIGN KEY ("paid_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_receipts_season_idx" ON "purchase_receipts" USING btree ("season_id");--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_purchase_receipt_id_purchase_receipts_id_fk" FOREIGN KEY ("purchase_receipt_id") REFERENCES "public"."purchase_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movement_links_purchase_receipt_idx" ON "movement_links" USING btree ("purchase_receipt_id");--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_target_xor" CHECK ((
        (case when "movement_links"."received_invoice_id" is not null then 1 else 0 end) +
        (case when "movement_links"."issued_invoice_id" is not null then 1 else 0 end) +
        (case when "movement_links"."sepa_remittance_id" is not null then 1 else 0 end) +
        (case when "movement_links"."sponsor_payment_id" is not null then 1 else 0 end) +
        (case when "movement_links"."purchase_receipt_id" is not null then 1 else 0 end)
      ) = 1);