ALTER TABLE "persons" ADD COLUMN "payer_person_id" uuid;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_payer_person_id_persons_id_fk" FOREIGN KEY ("payer_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: un menor no puede ser titular válido de un mandato SEPA. Para
-- jugadores con iban propio y tutor principal ya vinculado, el iban pasa a
-- ser el del tutor y el jugador queda enlazado como pagado a través de él.
UPDATE "persons" g
SET "iban" = p."iban",
    "sepa_consent" = p."sepa_consent"
FROM "persons" p
JOIN "person_guardians" pg ON pg."person_id" = p."id" AND pg."is_primary" = true
WHERE g."id" = pg."guardian_id"
  AND p."iban" IS NOT NULL
  AND g."iban" IS NULL;--> statement-breakpoint
UPDATE "persons" p
SET "payer_person_id" = pg."guardian_id",
    "iban" = NULL,
    "sepa_consent" = false
FROM "person_guardians" pg
WHERE pg."person_id" = p."id"
  AND pg."is_primary" = true
  AND p."iban" IS NOT NULL;