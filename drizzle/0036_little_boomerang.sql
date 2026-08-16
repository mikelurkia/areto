ALTER TABLE "users" ALTER COLUMN "locale" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'eu'::text;--> statement-breakpoint
DROP TYPE "public"."user_locale";--> statement-breakpoint
CREATE TYPE "public"."user_locale" AS ENUM('eu', 'es');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'eu'::"public"."user_locale";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "locale" SET DATA TYPE "public"."user_locale" USING "locale"::"public"."user_locale";