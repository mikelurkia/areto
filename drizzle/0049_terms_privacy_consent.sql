ALTER TABLE "persons" ADD COLUMN "terms_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "privacy_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" RENAME COLUMN "image_consent" TO "photo_consent";--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "privacy_consent" boolean DEFAULT false NOT NULL;
