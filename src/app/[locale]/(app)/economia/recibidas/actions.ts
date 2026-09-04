"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  accountMovements,
  movementLinks,
  receivedInvoiceStatus,
  receivedInvoices,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import { ECONOMIA_VIEW_PERMISSIONS, LEDGERS, canManageLedger, type Ledger } from "@/lib/economia";
import { readAmountCents } from "@/lib/money";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Bucket del adjunto según el libro de la factura: uno por libro, ver `docs/plan-modulo-economico.md`. */
function fileBucket(ledger: Ledger): string {
  return ledger === "internal" ? "invoice-files-internal" : "invoice-files";
}

async function uploadInvoiceFile(ledger: Ledger, invoiceId: string, file: File) {
  const path = `${invoiceId}/invoice.${extensionFromMimeType(file.type)}`;
  await uploadFile(fileBucket(ledger), path, file);
  return { path, name: file.name };
}

async function removeInvoiceFileObject(ledger: Ledger, path: string) {
  await removeFile(fileBucket(ledger), path);
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

function readStatus(formData: FormData): (typeof receivedInvoiceStatus.enumValues)[number] {
  const value = String(formData.get("status") ?? "");
  return (receivedInvoiceStatus.enumValues as readonly string[]).includes(value)
    ? (value as (typeof receivedInvoiceStatus.enumValues)[number])
    : "pending";
}

function readInvoiceFields(formData: FormData, t: Translator) {
  const supplierId = String(formData.get("supplierId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const issuedOn = String(formData.get("issuedOn") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const baseCents = readAmountCents(formData.get("base"));
  const vatCents = readAmountCents(formData.get("vat")) ?? 0;
  const withholdingCents = readAmountCents(formData.get("withholding")) ?? 0;
  const totalCents = readAmountCents(formData.get("total"));

  if (!supplierId) return { error: t("invoiceSupplierRequired") } as const;
  if (!seasonId) return { error: t("movementSeasonRequired") } as const;
  if (!invoiceNumber) return { error: t("invoiceNumberRequired") } as const;
  if (!issuedOn) return { error: t("invoiceIssuedOnRequired") } as const;
  if (baseCents === null) return { error: t("invoiceBaseRequired") } as const;
  if (totalCents === null) return { error: t("invoiceTotalRequired") } as const;

  return {
    supplierId,
    values: {
      supplierId,
      seasonId,
      teamId: teamId && teamId !== "none" ? teamId : null,
      categoryId: categoryId && categoryId !== "none" ? categoryId : null,
      invoiceNumber,
      issuedOn,
      dueDate: dueDate || null,
      baseCents,
      vatCents,
      withholdingCents,
      totalCents,
      status: readStatus(formData),
      description: String(formData.get("description") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  } as const;
}

export async function createReceivedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const ledger = readLedger(formData);
  if (!ledger || !canManageLedger(user, ledger)) return { error: t("notAllowed") };

  const parsed = readInvoiceFields(formData, t);
  if ("error" in parsed) return parsed;

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };

  let created;
  try {
    [created] = await db
      .insert(receivedInvoices)
      .values({ ...parsed.values, ledger })
      .returning({ id: receivedInvoices.id });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("invoiceNumberTaken") };
    throw error;
  }

  if (file) {
    const uploaded = await uploadInvoiceFile(ledger, created.id, file);
    await db
      .update(receivedInvoices)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(receivedInvoices.id, created.id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "received_invoice",
    entityId: created.id,
    metadata: { ledger, invoiceNumber: parsed.values.invoiceNumber, totalCents: parsed.values.totalCents },
  });

  revalidateRoutes(ROUTE.economiaRecibidas);
  return { message: t("receivedInvoiceCreated") };
}

export async function updateReceivedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.receivedInvoices.findFirst({
    where: eq(receivedInvoices.id, id),
    columns: { ledger: true, filePath: true },
  });
  if (!current) return { error: t("receivedInvoiceNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  const parsed = readInvoiceFields(formData, t);
  if ("error" in parsed) return parsed;

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };
  const removeFileFlag = formData.get("removeFile") === "on";

  try {
    await db.update(receivedInvoices).set(parsed.values).where(eq(receivedInvoices.id, id));
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("invoiceNumberTaken") };
    throw error;
  }

  if (file) {
    if (current.filePath) await removeInvoiceFileObject(current.ledger, current.filePath);
    const uploaded = await uploadInvoiceFile(current.ledger, id, file);
    await db
      .update(receivedInvoices)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(receivedInvoices.id, id));
  } else if (removeFileFlag && current.filePath) {
    await removeInvoiceFileObject(current.ledger, current.filePath);
    await db
      .update(receivedInvoices)
      .set({ filePath: null, fileName: null })
      .where(eq(receivedInvoices.id, id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "received_invoice",
    entityId: id,
    metadata: { ledger: current.ledger, invoiceNumber: parsed.values.invoiceNumber },
  });

  revalidateRoutes(ROUTE.economiaRecibidas, ROUTE.economiaRecibidaFicha);
  return { message: t("receivedInvoiceUpdated") };
}

export async function deleteReceivedInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.receivedInvoices.findFirst({
    where: eq(receivedInvoices.id, id),
    columns: { ledger: true, invoiceNumber: true, filePath: true },
  });
  if (!current) return { error: t("receivedInvoiceNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  await db.delete(receivedInvoices).where(eq(receivedInvoices.id, id));
  if (current.filePath) await removeInvoiceFileObject(current.ledger, current.filePath);

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "received_invoice",
    entityId: id,
    metadata: { ledger: current.ledger, invoiceNumber: current.invoiceNumber },
  });

  revalidateRoutes(ROUTE.economiaRecibidas);
  return { message: t("receivedInvoiceDeleted") };
}

// ---------------------------------------------------------------------------
// Conciliación: enlazar/desenlazar apuntes bancarios con una factura recibida
// ---------------------------------------------------------------------------

export async function linkMovementToInvoice(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const movementId = String(formData.get("movementId") ?? "");
  const receivedInvoiceId = String(formData.get("receivedInvoiceId") ?? "");
  const amountCents = readAmountCents(formData.get("amount"));
  if (!movementId || !receivedInvoiceId) return { error: t("notAllowed") };
  if (amountCents === null || amountCents === 0) return { error: t("movementAmountRequired") };

  const [movement, invoice] = await Promise.all([
    db.query.accountMovements.findFirst({
      where: eq(accountMovements.id, movementId),
      columns: { ledger: true },
    }),
    db.query.receivedInvoices.findFirst({
      where: eq(receivedInvoices.id, receivedInvoiceId),
      columns: { ledger: true },
    }),
  ]);
  if (!movement) return { error: t("movementNotFound") };
  if (!invoice) return { error: t("receivedInvoiceNotFound") };
  if (movement.ledger !== invoice.ledger) return { error: t("notAllowed") };
  if (!canManageLedger(user, movement.ledger)) return { error: t("notAllowed") };

  try {
    await db.insert(movementLinks).values({ movementId, receivedInvoiceId, amountCents });
  } catch (error) {
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) return { error: t("notAllowed") };
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "movement_link",
    entityId: movementId,
    metadata: { receivedInvoiceId, amountCents },
  });

  revalidateRoutes(ROUTE.economiaRecibidaFicha);
  return { message: t("linkCreated") };
}

export async function unlinkMovement(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const link = await db.query.movementLinks.findFirst({
    where: eq(movementLinks.id, id),
    with: { movement: { columns: { ledger: true } } },
  });
  if (!link) return { error: t("notAllowed") };
  if (!canManageLedger(user, link.movement.ledger)) return { error: t("notAllowed") };

  await db.delete(movementLinks).where(eq(movementLinks.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "movement_link",
    entityId: id,
    metadata: { receivedInvoiceId: link.receivedInvoiceId },
  });

  revalidateRoutes(ROUTE.economiaRecibidaFicha);
  return { message: t("linkDeleted") };
}
