ALTER TABLE "persons" ADD COLUMN "sepa_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "photo_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "terms_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "privacy_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "sepa_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "terms_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "photo_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "privacy_consent_at" timestamp with time zone;