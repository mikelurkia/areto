"use server";

import { inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { purchaseReceipts, receivedInvoices } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { ECONOMIA_VIEW_PERMISSIONS, canManageLedger } from "@/lib/economia";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";

/**
 * Marcado en bloque desde pagos pendientes, la única tabla que mezcla tickets
 * y facturas recibidas: la selección llega por dos campos (`ids` para tickets,
 * `invoiceIds` para facturas) y cada uno marca a su manera —`markedPaidAt` el
 * ticket, `status` la factura—, de ahí que la acción viva aquí y no en una de
 * las dos secciones.
 */
export async function markPendingPaidBulk(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const receiptIds = formData.getAll("ids").map(String).filter(Boolean);
  const invoiceIds = formData.getAll("invoiceIds").map(String).filter(Boolean);
  if (receiptIds.length === 0 && invoiceIds.length === 0) return { error: t("notAllowed") };

  const [receipts, invoices] = await Promise.all([
    receiptIds.length > 0
      ? db.query.purchaseReceipts.findMany({
          where: inArray(purchaseReceipts.id, receiptIds),
          columns: { id: true, ledger: true },
        })
      : [],
    invoiceIds.length > 0
      ? db.query.receivedInvoices.findMany({
          where: inArray(receivedInvoices.id, invoiceIds),
          columns: { id: true, ledger: true },
        })
      : [],
  ]);

  const manageableReceipts = receipts.filter((r) => canManageLedger(user, r.ledger)).map((r) => r.id);
  const manageableInvoices = invoices.filter((i) => canManageLedger(user, i.ledger)).map((i) => i.id);
  if (manageableReceipts.length === 0 && manageableInvoices.length === 0) {
    return { error: t("notAllowed") };
  }

  if (manageableReceipts.length > 0) {
    await db
      .update(purchaseReceipts)
      .set({ markedPaidAt: new Date(), markedPaidBy: user.id })
      .where(inArray(purchaseReceipts.id, manageableReceipts));
  }
  if (manageableInvoices.length > 0) {
    await db
      .update(receivedInvoices)
      .set({ status: "paid" })
      .where(inArray(receivedInvoices.id, manageableInvoices));
  }

  await Promise.all([
    ...manageableReceipts.map((id) =>
      recordAuditEvent({
        actorUserId: user.id,
        action: "update",
        entityType: "purchase_receipt",
        entityId: id,
        metadata: { paid: true, bulk: true },
      }),
    ),
    ...manageableInvoices.map((id) =>
      recordAuditEvent({
        actorUserId: user.id,
        action: "update",
        entityType: "received_invoice",
        entityId: id,
        metadata: { paid: true, bulk: true },
      }),
    ),
  ]);

  revalidateRoutes(
    ROUTE.economiaPagos,
    ROUTE.economiaTickets,
    ROUTE.economiaTicketFicha,
    ROUTE.economiaRecibidas,
    ROUTE.economiaRecibidaFicha,
  );
  return {
    message: t("markedPaidBulk", {
      count: manageableReceipts.length + manageableInvoices.length,
    }),
  };
}
