ALTER TABLE "purchase_receipts" ADD COLUMN "marked_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD COLUMN "marked_paid_by" uuid;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_marked_paid_by_users_id_fk" FOREIGN KEY ("marked_paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;