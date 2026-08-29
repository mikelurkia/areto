CREATE TYPE "public"."sepa_charge_status" AS ENUM('pending', 'collected', 'returned');--> statement-breakpoint
CREATE TYPE "public"."sepa_mandate_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."sepa_remittance_kind" AS ENUM('player', 'member');--> statement-breakpoint
CREATE TYPE "public"."sepa_sequence_type" AS ENUM('FRST', 'RCUR');--> statement-breakpoint
CREATE TABLE "sepa_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remittance_id" uuid,
	"kind" "sepa_remittance_kind" NOT NULL,
	"season_id" uuid NOT NULL,
	"membership_id" uuid,
	"club_member_id" uuid,
	"payer_person_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "sepa_charge_status" DEFAULT 'pending' NOT NULL,
	"sequence_type" "sepa_sequence_type" NOT NULL,
	"collected_on" date,
	"returned_on" date,
	"return_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sepa_charges_membership_xor_club_member" CHECK (("sepa_charges"."membership_id" is not null) <> ("sepa_charges"."club_member_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "sepa_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sepa_mandate_counter" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sepa_mandate_counter" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sepa_mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payer_person_id" uuid NOT NULL,
	"rum" text NOT NULL,
	"signed_on" date NOT NULL,
	"status" "sepa_mandate_status" DEFAULT 'active' NOT NULL,
	"revoked_on" date,
	"iban_snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sepa_mandates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sepa_remittances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "sepa_remittance_kind" NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid,
	"period_key" text NOT NULL,
	"message_id" text NOT NULL,
	"collection_date" date NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "sepa_remittances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "sepa_creditor_id" text;--> statement-breakpoint
ALTER TABLE "sepa_charges" ADD CONSTRAINT "sepa_charges_remittance_id_sepa_remittances_id_fk" FOREIGN KEY ("remittance_id") REFERENCES "public"."sepa_remittances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_charges" ADD CONSTRAINT "sepa_charges_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_charges" ADD CONSTRAINT "sepa_charges_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_charges" ADD CONSTRAINT "sepa_charges_club_member_id_club_members_id_fk" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_charges" ADD CONSTRAINT "sepa_charges_payer_person_id_persons_id_fk" FOREIGN KEY ("payer_person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_charges" ADD CONSTRAINT "sepa_charges_mandate_id_sepa_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."sepa_mandates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_mandates" ADD CONSTRAINT "sepa_mandates_payer_person_id_persons_id_fk" FOREIGN KEY ("payer_person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_remittances" ADD CONSTRAINT "sepa_remittances_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_remittances" ADD CONSTRAINT "sepa_remittances_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepa_remittances" ADD CONSTRAINT "sepa_remittances_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sepa_charges_membership_period_idx" ON "sepa_charges" USING btree ("membership_id","season_id","period_key") WHERE "sepa_charges"."membership_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sepa_charges_club_member_period_idx" ON "sepa_charges" USING btree ("club_member_id","season_id","period_key") WHERE "sepa_charges"."club_member_id" is not null;--> statement-breakpoint
CREATE INDEX "sepa_charges_remittance_idx" ON "sepa_charges" USING btree ("remittance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sepa_mandates_rum_idx" ON "sepa_mandates" USING btree ("rum");--> statement-breakpoint
CREATE UNIQUE INDEX "sepa_mandates_active_payer_idx" ON "sepa_mandates" USING btree ("payer_person_id") WHERE "sepa_mandates"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "sepa_remittances_message_id_idx" ON "sepa_remittances" USING btree ("message_id");