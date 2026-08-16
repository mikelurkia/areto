CREATE TABLE "person_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"label" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "federation_group" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "federation_code" text;--> statement-breakpoint
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;