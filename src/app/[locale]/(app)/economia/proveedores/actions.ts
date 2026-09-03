"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import { ECONOMIA_VIEW_PERMISSIONS, canManageSuppliers } from "@/lib/economia";
import { isValidIban } from "@/lib/iban";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function readSupplierFields(formData: FormData, t: Translator) {
  const name = String(formData.get("name") ?? "").trim();
  const taxId = String(formData.get("taxId") ?? "").trim();
  const iban = String(formData.get("iban") ?? "").trim();
  const defaultCategoryId = String(formData.get("defaultCategoryId") ?? "");

  if (!name) return { error: t("supplierNameRequired") } as const;
  if (iban && !isValidIban(iban)) return { error: t("accountIbanInvalid") } as const;

  return {
    values: {
      name,
      taxId: taxId || null,
      iban: iban ? iban.replace(/\s+/g, "").toUpperCase() : null,
      contactName: String(formData.get("contactName") ?? "").trim() || null,
      contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
      contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
      defaultCategoryId:
        defaultCategoryId && defaultCategoryId !== "none" ? defaultCategoryId : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  } as const;
}

export async function createSupplier(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  if (!canManageSuppliers(user)) return { error: t("notAllowed") };

  const parsed = readSupplierFields(formData, t);
  if ("error" in parsed) return parsed;

  let created;
  try {
    [created] = await db.insert(suppliers).values(parsed.values).returning({ id: suppliers.id });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("supplierTaxIdTaken") };
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "supplier",
    entityId: created.id,
    metadata: { name: parsed.values.name },
  });

  revalidateRoutes(ROUTE.economiaProveedores, ROUTE.economiaRecibidas);
  return { message: t("supplierCreated") };
}

export async function updateSupplier(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  if (!canManageSuppliers(user)) return { error: t("notAllowed") };

  const id = String(formData.get("id") ?? "");
  const parsed = readSupplierFields(formData, t);
  if ("error" in parsed) return parsed;

  try {
    await db.update(suppliers).set(parsed.values).where(eq(suppliers.id, id));
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("supplierTaxIdTaken") };
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "supplier",
    entityId: id,
    metadata: { name: parsed.values.name },
  });

  revalidateRoutes(ROUTE.economiaProveedores, ROUTE.economiaRecibidas);
  return { message: t("supplierUpdated") };
}

export async function deleteSupplier(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  if (!canManageSuppliers(user)) return { error: t("notAllowed") };

  const id = String(formData.get("id") ?? "");
  const current = await db.query.suppliers.findFirst({
    where: eq(suppliers.id, id),
    columns: { name: true },
  });
  if (!current) return { error: t("supplierNotFound") };

  try {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  } catch (error) {
    // La FK de `received_invoices` es `restrict`: un proveedor con facturas no se borra.
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) {
      return { error: t("supplierHasInvoices") };
    }
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "supplier",
    entityId: id,
    metadata: { name: current.name },
  });

  revalidateRoutes(ROUTE.economiaProveedores, ROUTE.economiaRecibidas);
  return { message: t("supplierDeleted") };
}
