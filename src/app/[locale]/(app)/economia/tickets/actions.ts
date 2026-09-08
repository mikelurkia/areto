"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, movementLinks, purchaseReceipts } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { FOREIGN_KEY_VIOLATION, isPostgresError } from "@/lib/db-errors";
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
import { uploadLinkReceiptFile } from "@/app/[locale]/(app)/economia/recibidas/actions";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

async function uploadReceiptFile(ledger: Ledger, receiptId: string, file: File) {
  const path = `${receiptId}/invoice.${extensionFromMimeType(file.type)}`;
  await uploadFile(invoiceFileBucket(ledger), path, file);
  return { path, name: file.name };
}

async function removeReceiptFileObject(ledger: Ledger, path: string) {
  await removeFile(invoiceFileBucket(ledger), path);
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

function readReceiptFields(formData: FormData, t: Translator) {
  const seasonId = String(formData.get("seasonId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const paidByPersonId = String(formData.get("paidByPersonId") ?? "");
  const purchasedOn = String(formData.get("purchasedOn") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const totalCents = readAmountCents(formData.get("total"));

  if (!seasonId) return { error: t("movementSeasonRequired") } as const;
  if (!purchasedOn) return { error: t("ticketPurchasedOnRequired") } as const;
  if (!description) return { error: t("ticketDescriptionRequired") } as const;
  if (totalCents === null) return { error: t("ticketTotalRequired") } as const;

  return {
    values: {
      seasonId,
      teamId: teamId && teamId !== "none" ? teamId : null,
      categoryId: categoryId && categoryId !== "none" ? categoryId : null,
      paidByPersonId: paidByPersonId && paidByPersonId !== "none" ? paidByPersonId : null,
      purchasedOn,
      description,
      totalCents,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  } as const;
}

export async function createPurchaseReceipt(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const ledger = readLedger(formData);
  if (!ledger || !canManageLedger(user, ledger)) return { error: t("notAllowed") };

  const parsed = readReceiptFields(formData, t);
  if ("error" in parsed) return parsed;

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };

  const [created] = await db
    .insert(purchaseReceipts)
    .values({ ...parsed.values, ledger })
    .returning({ id: purchaseReceipts.id });

  if (file) {
    const uploaded = await uploadReceiptFile(ledger, created.id, file);
    await db
      .update(purchaseReceipts)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(purchaseReceipts.id, created.id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "purchase_receipt",
    entityId: created.id,
    metadata: { ledger, totalCents: parsed.values.totalCents },
  });

  revalidateRoutes(ROUTE.economiaTickets);
  return { message: t("purchaseReceiptCreated") };
}

export async function updatePurchaseReceipt(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.purchaseReceipts.findFirst({
    where: eq(purchaseReceipts.id, id),
    columns: { ledger: true, filePath: true },
  });
  if (!current) return { error: t("purchaseReceiptNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  const parsed = readReceiptFields(formData, t);
  if ("error" in parsed) return parsed;

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };
  const removeFileFlag = formData.get("removeFile") === "on";

  await db.update(purchaseReceipts).set(parsed.values).where(eq(purchaseReceipts.id, id));

  if (file) {
    if (current.filePath) await removeReceiptFileObject(current.ledger, current.filePath);
    const uploaded = await uploadReceiptFile(current.ledger, id, file);
    await db
      .update(purchaseReceipts)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(purchaseReceipts.id, id));
  } else if (removeFileFlag && current.filePath) {
    await removeReceiptFileObject(current.ledger, current.filePath);
    await db
      .update(purchaseReceipts)
      .set({ filePath: null, fileName: null })
      .where(eq(purchaseReceipts.id, id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "purchase_receipt",
    entityId: id,
    metadata: { ledger: current.ledger },
  });

  revalidateRoutes(ROUTE.economiaTickets, ROUTE.economiaTicketFicha);
  return { message: t("purchaseReceiptUpdated") };
}

export async function deletePurchaseReceipt(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.purchaseReceipts.findFirst({
    where: eq(purchaseReceipts.id, id),
    columns: { ledger: true, description: true, filePath: true },
  });
  if (!current) return { error: t("purchaseReceiptNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  await db.delete(purchaseReceipts).where(eq(purchaseReceipts.id, id));
  if (current.filePath) await removeReceiptFileObject(current.ledger, current.filePath);

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "purchase_receipt",
    entityId: id,
    metadata: { ledger: current.ledger, description: current.description },
  });

  revalidateRoutes(ROUTE.economiaTickets);
  return { message: t("purchaseReceiptDeleted") };
}

// ---------------------------------------------------------------------------
// Conciliación: enlazar un apunte bancario con un ticket de compra. Desenlazar
// y el justificante de pago son genéricos y viven en `recibidas/actions.ts`.
// ---------------------------------------------------------------------------

export async function linkMovementToPurchaseReceipt(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const movementId = String(formData.get("movementId") ?? "");
  const purchaseReceiptId = String(formData.get("purchaseReceiptId") ?? "");
  const amountCents = readAmountCents(formData.get("amount"));
  if (!movementId || !purchaseReceiptId) return { error: t("notAllowed") };
  if (amountCents === null || amountCents === 0) return { error: t("movementAmountRequired") };

  const file = readFile(formData);
  if (file && !ALLOWED_FILE_TYPES.includes(file.type)) return { error: t("invoiceFileInvalidType") };
  if (file && file.size > MAX_FILE_BYTES) return { error: t("invoiceFileTooLarge") };

  const [movement, receipt] = await Promise.all([
    db.query.accountMovements.findFirst({
      where: eq(accountMovements.id, movementId),
      columns: { ledger: true },
    }),
    db.query.purchaseReceipts.findFirst({
      where: eq(purchaseReceipts.id, purchaseReceiptId),
      columns: { ledger: true },
    }),
  ]);
  if (!movement) return { error: t("movementNotFound") };
  if (!receipt) return { error: t("purchaseReceiptNotFound") };
  if (movement.ledger !== receipt.ledger) return { error: t("notAllowed") };
  if (!canManageLedger(user, movement.ledger)) return { error: t("notAllowed") };

  let created;
  try {
    [created] = await db
      .insert(movementLinks)
      .values({ movementId, purchaseReceiptId, amountCents })
      .returning({ id: movementLinks.id });
  } catch (error) {
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) return { error: t("notAllowed") };
    throw error;
  }

  if (file) {
    const uploaded = await uploadLinkReceiptFile(movement.ledger, created.id, file);
    await db
      .update(movementLinks)
      .set({ filePath: uploaded.path, fileName: uploaded.name })
      .where(eq(movementLinks.id, created.id));
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "movement_link",
    entityId: movementId,
    metadata: { purchaseReceiptId, amountCents },
  });

  revalidateRoutes(ROUTE.economiaTicketFicha, ROUTE.economiaMovimientos);
  return { message: t("linkCreated") };
}
