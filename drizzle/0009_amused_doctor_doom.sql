ALTER TABLE "memberships" ADD COLUMN "is_goalkeeper" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "kit_shirt_issued" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "kit_pants_issued" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "kit_bib_issued" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "photo_filename" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "medical_cert_until" date;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "iban" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "guardian_id" uuid;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "shirt_size" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "pants_size" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "shoe_size" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "form_signed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "photo_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_guardian_id_persons_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;