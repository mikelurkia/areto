CREATE TYPE "public"."user_locale" AS ENUM('eu', 'es', 'gl', 'ca', 'en');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "user_locale" DEFAULT 'eu' NOT NULL;