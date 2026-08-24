CREATE TABLE "registration_submission_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "registration_kind" NOT NULL,
	"email" text,
	"message" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_submission_errors" ENABLE ROW LEVEL SECURITY;