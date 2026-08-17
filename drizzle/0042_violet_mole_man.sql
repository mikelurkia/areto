CREATE TYPE "public"."registration_kind" AS ENUM('player', 'coach');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "person_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"national_id" text,
	"address" text,
	"city" text,
	"phone" text,
	"email" text,
	"matched_person_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "registration_kind" NOT NULL,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"season_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"national_id" text,
	"address" text,
	"city" text,
	"phone" text,
	"email" text,
	"iban" text,
	"shirt_size" text,
	"pants_size" text,
	"shoe_size" text,
	"installments_chosen" integer,
	"sepa_consent" boolean DEFAULT false NOT NULL,
	"image_consent" boolean DEFAULT false NOT NULL,
	"photo_path" text,
	"id_front_path" text,
	"id_back_path" text,
	"matched_person_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "sepa_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "person_guardians" ADD CONSTRAINT "person_guardians_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_guardians" ADD CONSTRAINT "person_guardians_guardian_id_persons_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_guardians" ADD CONSTRAINT "registration_guardians_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_guardians" ADD CONSTRAINT "registration_guardians_matched_person_id_persons_id_fk" FOREIGN KEY ("matched_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_matched_person_id_persons_id_fk" FOREIGN KEY ("matched_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_guardians_pair_idx" ON "person_guardians" USING btree ("person_id","guardian_id");