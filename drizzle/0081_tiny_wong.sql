CREATE TYPE "public"."movement_import_format" AS ENUM('n43', 'csv');--> statement-breakpoint
CREATE TABLE "movement_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"format" "movement_import_format" NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by_user_id" uuid,
	"row_count" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movement_import_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_movements" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "account_movements" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "movement_import_batches" ADD CONSTRAINT "movement_import_batches_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_import_batches" ADD CONSTRAINT "movement_import_batches_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_import_batch_id_movement_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."movement_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_movements_account_fingerprint_idx" ON "account_movements" USING btree ("account_id","fingerprint");