"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, issuedInvoices, movementLinks } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { getClubSettings, hasIssuerData, nextInvoiceNumber } from "@/lib/club";
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGERS,
  canManageLedger,
  invoiceFileBucket,
  type Ledger,
} from "@/lib/economia";
import { readAmountCents } from "@/lib/money";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Las emitidas comparten bucket con las recibidas y se separan por prefijo. */
async function uploadInvoiceFile(ledger: Ledger, invoiceId: string, file: File) {
  const path = `emitidas/${invoiceId}/invoice.${extensionFromMimeType(file.type)}`;
  await uploadFile(invoiceFileBucket(ledger), path, file);
  return { path, name: file.name };
}

function readFile(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

function readLedger(formData: FormData): Ledger | null {
  const value = String(formData.get("ledger") ?? "");
  return (LEDGERS as readonly string[]).includes(value) ? (value as Ledger) : null;
}

function readInvoiceFields(formData: FormData, t: Translator) {
  const seasonId = String(formData.get("seasonId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const issuedOn = String(formData.get("issuedOn") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const baseCents = readAmountCents(formData.get("base"));
  const vatCents = readAmountCents(formData.get("vat")) ?? 0;
  const withholdingCents = readAmountCents(formData.get("withholding")) ?? 0;
  const totalCents = readAmountCents(formData.get("total"));

  if (!seasonId) return { error: t("movementSeasonRequired") } as const;
  if (!customerName) return { error: t("customerNameRequired") } as const;
  if (!issuedOn) return { error: t("invoiceIssuedOnRequired") } as const;
  if (baseCents === null) return { error: t("invoiceBaseRequired") } as const;
  if (totalCents === null) return { error: t("invoiceTotalRequired") } as const;

  const sponsorId = String(formData.get("sponsorId") ?? "");
  const personId = String(formData.get("personId") ?? "");

  return {
    values: {
      seasonId,
      customerName,
      customerTaxId: String(formData.get("customerTaxId") ?? "").trim() || null,
      customerAddress: String(formData.get("customerAddress") ?? "").trim() || null,
      sponsorId: sponsorId || null,
      personId: personId || null,
      categoryId: categoryId && categoryId !== "none" ? categoryId : null,
      concept: String(formData.get("concept") ?? "").trim() || null,
      issuedOn,
      dueDate: dueDate || null,
      baseCents,
      vatCents,
      withholdingCents,
      totalCents,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  } as const;
}

export async function createIssuedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const ledger = readLedger(formData);
  if (!ledger || !canManageLedger(user, ledger)) return { error: t("notAllowed") };

  const parsed = readInvoiceFields(formData, t);
  if ("error" in parsed) return parsed;

  // Sin datos fiscales del club no se puede emitir: la factura saldría sin emisor.
  if (!hasIssuerData(await getClubSettings())) return { error: t("issuerDataMissing") };

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };

  // Reservar el número y escribir la factura van JUNTOS: si el insert falla
  // fuera de la transacción, el número queda quemado y la serie tiene un hueco.
  let created;
  try {
    created = await db.transaction(async (tx) => {
      const number = await nextInvoiceNumber(Number(parsed.values.issuedOn.slice(0, 4)), tx);
      const [row] = await tx
        .insert(issuedInvoices)
        .values({ ...parsed.values, ledger, number })
        .returning({ id: issuedInvoices.id, number: issuedInvoices.number });
      return row;
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("invoiceNumberTaken") };
    throw error;
  }

  if (file) {
    const uploaded = await uploadInvoiceFile(ledger, created.id, file);
    await db
      .update(issuedInvoices)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(issuedInvoices.id, created.id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "issued_invoice",
    entityId: created.id,
    metadata: { ledger, number: created.number, totalCents: parsed.values.totalCents },
  });

  revalidateRoutes(ROUTE.economiaEmitidas);
  return { message: t("issuedInvoiceCreated", { number: created.number }) };
}

export async function updateIssuedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.issuedInvoices.findFirst({
    where: eq(issuedInvoices.id, id),
    columns: { ledger: true, number: true, filePath: true },
  });
  if (!current) return { error: t("issuedInvoiceNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  const parsed = readInvoiceFields(formData, t);
  if ("error" in parsed) return parsed;

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };
  const removeFileFlag = formData.get("removeFile") === "on";

  // El número NO se toca: es la serie fiscal. Tampoco el libro, que cambiaría
  // de sitio una factura ya emitida.
  await db.update(issuedInvoices).set(parsed.values).where(eq(issuedInvoices.id, id));

  if (file) {
    if (current.filePath) await removeFile(invoiceFileBucket(current.ledger), current.filePath);
    const uploaded = await uploadInvoiceFile(current.ledger, id, file);
    await db
      .update(issuedInvoices)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(issuedInvoices.id, id));
  } else if (removeFileFlag && current.filePath) {
    await removeFile(invoiceFileBucket(current.ledger), current.filePath);
    await db
      .update(issuedInvoices)
      .set({ filePath: null, fileName: null })
      .where(eq(issuedInvoices.id, id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "issued_invoice",
    entityId: id,
    metadata: { ledger: current.ledger, number: current.number },
  });

  revalidateRoutes(ROUTE.economiaEmitidas, ROUTE.economiaEmitidaFicha);
  return { message: t("issuedInvoiceUpdated") };
}

/**
 * Anula una factura emitida. No hay borrado: la serie no puede tener huecos,
 * así que la fila se queda con `status: cancelled` y sus importes a la vista
 * (decisión 7 del plan).
 */
export async function cancelIssuedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.issuedInvoices.findFirst({
    where: eq(issuedInvoices.id, id),
    columns: { ledger: true, number: true, status: true },
  });
  if (!current) return { error: t("issuedInvoiceNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };
  if (current.status !== "issued") return { error: t("invoiceNotCancellable") };

  await db.update(issuedInvoices).set({ status: "cancelled" }).where(eq(issuedInvoices.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "issued_invoice",
    entityId: id,
    metadata: { ledger: current.ledger, number: current.number, status: "cancelled" },
  });

  revalidateRoutes(ROUTE.economiaEmitidas, ROUTE.economiaEmitidaFicha);
  return { message: t("issuedInvoiceCancelled") };
}

/**
 * Emite la rectificativa de una factura: una factura nueva, con su propio
 * número correlativo e importes en negativo, que apunta a la original y la
 * deja en `rectified`. Todo en una transacción, como la emisión.
 */
export async function rectifyIssuedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const original = await db.query.issuedInvoices.findFirst({
    where: eq(issuedInvoices.id, id),
  });
  if (!original) return { error: t("issuedInvoiceNotFound") };
  if (!canManageLedger(user, original.ledger)) return { error: t("notAllowed") };
  if (original.status !== "issued") return { error: t("invoiceNotRectifiable") };

  const today = new Date().toISOString().slice(0, 10);

  const created = await db.transaction(async (tx) => {
    const number = await nextInvoiceNumber(Number(today.slice(0, 4)), tx);
    const [row] = await tx
      .insert(issuedInvoices)
      .values({
        number,
        ledger: original.ledger,
        seasonId: original.seasonId,
        issuedOn: today,
        customerName: original.customerName,
        customerTaxId: original.customerTaxId,
        customerAddress: original.customerAddress,
        sponsorId: original.sponsorId,
        personId: original.personId,
        categoryId: original.categoryId,
        concept: original.concept,
        baseCents: -original.baseCents,
        vatCents: -original.vatCents,
        withholdingCents: -original.withholdingCents,
        totalCents: -original.totalCents,
        rectifiesInvoiceId: original.id,
      })
      .returning({ id: issuedInvoices.id, number: issuedInvoices.number });
    await tx
      .update(issuedInvoices)
      .set({ status: "rectified" })
      .where(eq(issuedInvoices.id, original.id));
    return row;
  });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "issued_invoice",
    entityId: created.id,
    metadata: { ledger: original.ledger, number: created.number, rectifies: original.number },
  });

  revalidateRoutes(ROUTE.economiaEmitidas, ROUTE.economiaEmitidaFicha);
  return { message: t("issuedInvoiceRectified", { number: created.number }) };
}

// ---------------------------------------------------------------------------
// Conciliación: enlazar un apunte bancario con una factura emitida
// ---------------------------------------------------------------------------

export async function linkMovementToIssuedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const movementId = String(formData.get("movementId") ?? "");
  const issuedInvoiceId = String(formData.get("issuedInvoiceId") ?? "");
  const amountCents = readAmountCents(formData.get("amount"));
  if (!movementId || !issuedInvoiceId) return { error: t("notAllowed") };
  if (amountCents === null || amountCents === 0) return { error: t("movementAmountRequired") };

  const [movement, invoice] = await Promise.all([
    db.query.accountMovements.findFirst({
      where: eq(accountMovements.id, movementId),
      columns: { ledger: true },
    }),
    db.query.issuedInvoices.findFirst({
      where: eq(issuedInvoices.id, issuedInvoiceId),
      columns: { ledger: true },
    }),
  ]);
  if (!movement) return { error: t("movementNotFound") };
  if (!invoice) return { error: t("issuedInvoiceNotFound") };
  if (movement.ledger !== invoice.ledger) return { error: t("notAllowed") };
  if (!canManageLedger(user, movement.ledger)) return { error: t("notAllowed") };

  try {
    await db.insert(movementLinks).values({ movementId, issuedInvoiceId, amountCents });
  } catch (error) {
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) return { error: t("notAllowed") };
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "movement_link",
    entityId: movementId,
    metadata: { issuedInvoiceId, amountCents },
  });

  revalidateRoutes(ROUTE.economiaEmitidaFicha);
  return { message: t("linkCreated") };
}
