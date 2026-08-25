ALTER TABLE "persons" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "registration_guardians" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "postal_code" text;
--> statement-breakpoint
-- Backfill del CP a partir del municipio. No hay ningún código postal
-- guardado hasta ahora (ni en `city` ni en `address`), pero el reparto de
-- municipios del club es casi todo local y estos tres tienen un único CP, así
-- que se deducen sin riesgo. Donostia queda fuera a propósito: tiene 18 CPs
-- distintos, y quien no tenga municipio no tiene nada de donde deducirlo —
-- esas fichas se completan a mano o cuando esa persona se reinscriba.
UPDATE "persons" SET "postal_code" = CASE lower(trim("city"))
    WHEN 'oñati' THEN '20560'
    WHEN 'eskoriatza' THEN '20540'
    WHEN 'arrasate' THEN '20500'
  END
  WHERE "postal_code" IS NULL
    AND lower(trim("city")) IN ('oñati', 'eskoriatza', 'arrasate');--> statement-breakpoint
UPDATE "registrations" SET "postal_code" = CASE lower(trim("city"))
    WHEN 'oñati' THEN '20560'
    WHEN 'eskoriatza' THEN '20540'
    WHEN 'arrasate' THEN '20500'
  END
  WHERE "postal_code" IS NULL
    AND lower(trim("city")) IN ('oñati', 'eskoriatza', 'arrasate');--> statement-breakpoint
UPDATE "registration_guardians" SET "postal_code" = CASE lower(trim("city"))
    WHEN 'oñati' THEN '20560'
    WHEN 'eskoriatza' THEN '20540'
    WHEN 'arrasate' THEN '20500'
  END
  WHERE "postal_code" IS NULL
    AND lower(trim("city")) IN ('oñati', 'eskoriatza', 'arrasate');
