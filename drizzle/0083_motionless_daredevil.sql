CREATE TYPE "public"."issued_invoice_status" AS ENUM('issued', 'rectified', 'cancelled');--> statement-breakpoint
CREATE TABLE "issued_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"ledger" "ledger" DEFAULT 'official' NOT NULL,
	"season_id" uuid NOT NULL,
	"issued_on" date NOT NULL,
	"due_date" date,
	"customer_name" text NOT NULL,
	"customer_tax_id" text,
	"customer_address" text,
	"sponsor_id" uuid,
	"person_id" uuid,
	"category_id" uuid,
	"concept" text,
	"base_cents" integer NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"withholding_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "issued_invoice_status" DEFAULT 'issued' NOT NULL,
	"rectifies_invoice_id" uuid,
	"source" "invoice_source" DEFAULT 'manual' NOT NULL,
	"file_path" text,
	"file_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issued_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sepa_remittances" ADD COLUMN "total_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sepa_remittances" ADD COLUMN "settled_on" date;--> statement-breakpoint
ALTER TABLE "sponsor_payments" ADD COLUMN "issued_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_category_id_economic_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."economic_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_rectifies_invoice_id_issued_invoices_id_fk" FOREIGN KEY ("rectifies_invoice_id") REFERENCES "public"."issued_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issued_invoices_number_idx" ON "issued_invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "issued_invoices_season_idx" ON "issued_invoices" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "issued_invoices_sponsor_idx" ON "issued_invoices" USING btree ("sponsor_id");--> statement-breakpoint
ALTER TABLE "movement_links" ADD CONSTRAINT "movement_links_issued_invoice_id_issued_invoices_id_fk" FOREIGN KEY ("issued_invoice_id") REFERENCES "public"."issued_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_payments" ADD CONSTRAINT "sponsor_payments_issued_invoice_id_issued_invoices_id_fk" FOREIGN KEY ("issued_invoice_id") REFERENCES "public"."issued_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movement_links_issued_invoice_idx" ON "movement_links" USING btree ("issued_invoice_id");--> statement-breakpoint
-- Backfill de la fase 5 del módulo económico (decisiones 6 y 7 del plan).
-- Añadido a mano: drizzle-kit solo genera DDL.

-- 1. Las facturas de patrocinio existentes pasan al registro único, congelando
--    los datos fiscales del patrocinador y el concepto tal y como estaban el
--    día de la emisión. `sponsor_payments.year` es el año de INICIO de la
--    temporada y `seasons.name` tiene el formato "2025/26"; si no casa ninguna
--    temporada, cae a la actual.
--    Si esto falla por el único de "number", hay números de factura duplicados
--    en sponsor_payments (hoy no tiene unique): resolverlos a mano antes.
INSERT INTO issued_invoices (
  number, ledger, season_id, issued_on,
  customer_name, customer_tax_id, customer_address, sponsor_id,
  concept, base_cents, vat_cents, withholding_cents, total_cents, status
)
SELECT
  p.invoice_number,
  'official',
  COALESCE(s.id, (SELECT id FROM seasons WHERE is_current LIMIT 1)),
  COALESCE(p.invoiced_on, CURRENT_DATE),
  COALESCE(sp.fiscal_name, sp.name),
  sp.tax_id,
  sp.fiscal_address,
  sp.id,
  'Patrocinio ' || sp.name || COALESCE(' · ' || s.name, ''),
  p.amount_cents, 0, 0, p.amount_cents,
  'issued'
FROM sponsor_payments p
JOIN sponsorship_terms t ON t.id = p.term_id
JOIN sponsors sp ON sp.id = t.sponsor_id
LEFT JOIN seasons s
  ON s.name = p.year::text || '/' || lpad(((p.year + 1) % 100)::text, 2, '0')
WHERE p.invoice_number IS NOT NULL;
--> statement-breakpoint
UPDATE sponsor_payments p
SET issued_invoice_id = i.id
FROM issued_invoices i
WHERE i.number = p.invoice_number;
--> statement-breakpoint
-- 2. Total congelado de las remesas ya generadas. Es lo mejor reconstruible:
--    los cargos devueltos perdieron su `remittance_id` (ver updateChargeStatus),
--    así que una remesa con devoluciones queda por debajo de lo que se envió.
--    De aquí en adelante lo congela `createRemittance` al generarla.
UPDATE sepa_remittances r
SET total_cents = COALESCE((
  SELECT sum(c.amount_cents) FROM sepa_charges c WHERE c.remittance_id = r.id
), 0);
