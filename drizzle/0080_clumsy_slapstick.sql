CREATE TYPE "public"."movement_source" AS ENUM('import', 'manual');--> statement-breakpoint
CREATE TABLE "account_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"ledger" "ledger" NOT NULL,
	"season_id" uuid NOT NULL,
	"booked_on" date NOT NULL,
	"value_on" date,
	"amount_cents" integer NOT NULL,
	"concept" text NOT NULL,
	"counterparty" text,
	"balance_cents" integer,
	"category_id" uuid,
	"source" "movement_source" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_category_id_economic_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."economic_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_movements_account_booked_idx" ON "account_movements" USING btree ("account_id","booked_on");