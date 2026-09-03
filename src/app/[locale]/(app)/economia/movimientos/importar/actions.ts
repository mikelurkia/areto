"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, financialAccounts, movementImportBatches } from "@/db/schema";
import { recordAuditEvent } from "@/lib/audit-log";
import { requirePermission } from "@/lib/auth";
import { ECONOMIA_VIEW_PERMISSIONS, canManageLedger } from "@/lib/economia";
import { assignFingerprints } from "@/lib/movement-import";
import { CsvParseError, parseMovementsCsv } from "@/lib/movement-csv";
import { N43ParseError, parseN43 } from "@/lib/n43";
import { seasonLabel, seasonYearOf } from "@/lib/sponsorship";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";

export type ImportMovementsState = EconomiaState & {
  imported?: number;
  skipped?: number;
};

/**
 * Todos los errores de parseo se traducen aquí a un único mensaje genérico
 * (`importParseError`): son ficheros exportados por un banco, no hay usuario
 * corrigiendo una fila a la vez, así que un desglose línea a línea no ayuda
 * más que "el fichero no tiene la pinta esperada".
 */
export async function importMovements(
  _prev: ImportMovementsState,
  formData: FormData,
): Promise<ImportMovementsState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const accountId = String(formData.get("accountId") ?? "");
  const rawFormat = String(formData.get("format") ?? "");
  const format: "n43" | "csv" | null =
    rawFormat === "n43" || rawFormat === "csv" ? rawFormat : null;
  const fileField = formData.get("file");
  const file = fileField instanceof File && fileField.size > 0 ? fileField : null;

  if (!accountId) return { error: t("movementAccountRequired") };
  if (!format) return { error: t("importFormatRequired") };
  if (!file) return { error: t("importFileRequired") };

  const account = await db.query.financialAccounts.findFirst({
    where: eq(financialAccounts.id, accountId),
    columns: { ledger: true, isActive: true },
  });
  if (!account) return { error: t("accountNotFound") };
  if (!canManageLedger(user, account.ledger)) return { error: t("notAllowed") };
  if (!account.isActive) return { error: t("importAccountInactive") };

  const bytes = Buffer.from(await file.arrayBuffer());
  const content = format === "n43" ? bytes.toString("latin1") : bytes.toString("utf-8");

  let parsed;
  try {
    parsed = format === "n43" ? parseN43(content) : parseMovementsCsv(content);
  } catch (error) {
    if (error instanceof N43ParseError || error instanceof CsvParseError) {
      return { error: t("importParseError") };
    }
    throw error;
  }

  const allSeasons = await db.query.seasons.findMany({
    columns: { id: true, name: true },
  });
  const seasonIdByName = new Map(allSeasons.map((s) => [s.name, s.id]));

  const seasonIds = parsed.movements.map((m) => seasonIdByName.get(seasonLabel(seasonYearOf(m.bookedOn))));
  if (seasonIds.some((id) => !id)) {
    return { error: t("importSeasonMissing") };
  }

  const fingerprinted = assignFingerprints(accountId, parsed.movements);

  const { batchId, imported, skipped } = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(movementImportBatches)
      .values({
        accountId,
        fileName: file.name,
        format,
        importedByUserId: user.id,
        rowCount: fingerprinted.length,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
      })
      .returning({ id: movementImportBatches.id });

    const inserted = await tx
      .insert(accountMovements)
      .values(
        fingerprinted.map((movement, i) => ({
          accountId,
          ledger: account.ledger,
          seasonId: seasonIds[i]!,
          bookedOn: movement.bookedOn,
          valueOn: movement.valueOn,
          amountCents: movement.amountCents,
          concept: movement.concept,
          counterparty: movement.counterparty,
          balanceCents: movement.balanceCents,
          source: "import" as const,
          fingerprint: movement.fingerprint,
          importBatchId: batch.id,
        })),
      )
      .onConflictDoNothing({
        target: [accountMovements.accountId, accountMovements.fingerprint],
      })
      .returning({ id: accountMovements.id });

    return {
      batchId: batch.id,
      imported: inserted.length,
      skipped: fingerprinted.length - inserted.length,
    };
  });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "movement_import_batch",
    entityId: batchId,
    metadata: { accountId, format, imported, skipped, fromDate: parsed.fromDate, toDate: parsed.toDate },
  });

  return { message: t("importDone", { imported, skipped }), imported, skipped };
}
