ALTER TABLE "teams" ADD COLUMN "player_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "player_fee_period" "fee_period" DEFAULT 'season' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "player_fee_notes" text;