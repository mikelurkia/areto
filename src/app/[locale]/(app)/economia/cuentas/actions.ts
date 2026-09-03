"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { economicCategories, financialAccounts } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGERS,
  canManageLedger,
  type Ledger,
} from "@/lib/economia";
import { isValidIban } from "@/lib/iban";
import { readAmountCents } from "@/lib/money";

export type EconomiaState = {
  error?: string;
  message?: string;
};

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const ACCOUNT_KINDS = ["bank", "cash"] as const;
type AccountKind = (typeof ACCOUNT_KINDS)[number];

const CATEGORY_KINDS = ["income", "expense"] as const;
type CategoryKind = (typeof CATEGORY_KINDS)[number];

function readLedger(formData: FormData): Ledger | null {
  const value = String(formData.get("ledger") ?? "");
  return (LEDGERS as readonly string[]).includes(value) ? (value as Ledger) : null;
}

function readAccountKind(formData: FormData): AccountKind | null {
  const value = String(formData.get("kind") ?? "");
  return (ACCOUNT_KINDS as readonly string[]).includes(value) ? (value as AccountKind) : null;
}

function readCategoryKind(formData: FormData): CategoryKind | null {
  const value = String(formData.get("kind") ?? "");
  return (CATEGORY_KINDS as readonly string[]).includes(value) ? (value as CategoryKind) : null;
}

// --- Cuentas -----------------------------------------------------------------

/**
 * Campos comunes del formulario de cuenta. El IBAN solo se valida en las de
 * banco: una caja de efectivo no tiene.
 */
function readAccountFields(formData: FormData, t: Translator) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = readAccountKind(formData);
  const iban = String(formData.get("iban") ?? "").trim();
  const openingBalanceOn = String(formData.get("openingBalanceOn") ?? "").trim();

  if (!name) return { error: t("accountNameRequired") } as const;
  if (!kind) return { error: t("accountKindRequired") } as const;
  if (kind === "bank" && iban && !isValidIban(iban)) {
    return { error: t("accountIbanInvalid") } as const;
  }

  return {
    values: {
      name,
      kind,
      iban: kind === "bank" && iban ? iban.replace(/\s+/g, "").toUpperCase() : null,
      openingBalanceCents: readAmountCents(formData.get("openingBalance")) ?? 0,
      openingBalanceOn: openingBalanceOn || null,
      isActive: formData.get("isActive") === "on",
    },
  } as const;
}

export async function createAccount(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const ledger = readLedger(formData);
  if (!ledger || !canManageLedger(user, ledger)) return { error: t("notAllowed") };

  const parsed = readAccountFields(formData, t);
  if ("error" in parsed) return parsed;

  let created;
  try {
    [created] = await db
      .insert(financialAccounts)
      .values({ ...parsed.values, ledger })
      .returning({ id: financialAccounts.id });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("accountNameTaken") };
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "financial_account",
    entityId: created.id,
    metadata: { ledger, name: parsed.values.name },
  });

  return { message: t("accountCreated") };
}

export async function updateAccount(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const nextLedger = readLedger(formData);
  if (!id || !nextLedger) return { error: t("notAllowed") };

  const current = await db.query.financialAccounts.findFirst({
    where: eq(financialAccounts.id, id),
    columns: { ledger: true },
  });
  if (!current) return { error: t("accountNotFound") };

  // Cambiar de libro es un alta y una baja: hacen falta las dos `manage`, no
  // basta la del libro de destino.
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };
  if (nextLedger !== current.ledger && !canManageLedger(user, nextLedger)) {
    return { error: t("notAllowed") };
  }

  const parsed = readAccountFields(formData, t);
  if ("error" in parsed) return parsed;

  try {
    await db
      .update(financialAccounts)
      .set({ ...parsed.values, ledger: nextLedger })
      .where(eq(financialAccounts.id, id));
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("accountNameTaken") };
    throw error;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "financial_account",
    entityId: id,
    metadata: { ledger: nextLedger, previousLedger: current.ledger, name: parsed.values.name },
  });

  return { message: t("accountUpdated") };
}

export async function deleteAccount(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.financialAccounts.findFirst({
    where: eq(financialAccounts.id, id),
    columns: { ledger: true, name: true },
  });
  if (!current) return { error: t("accountNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  await db.delete(financialAccounts).where(eq(financialAccounts.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "financial_account",
    entityId: id,
    metadata: { ledger: current.ledger, name: current.name },
  });

  return { message: t("accountDeleted") };
}

// --- Categorías --------------------------------------------------------------

/**
 * Las categorías son la dimensión COMPARTIDA por los dos libros y no llevan
 * `ledger`: basta con poder gestionar uno de los dos para mantenerlas.
 */
function canManageCategories(user: Parameters<typeof canManageLedger>[0]): boolean {
  return LEDGERS.some((value) => canManageLedger(user, value));
}

function readCategoryFields(formData: FormData, t: Translator) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = readCategoryKind(formData);
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!name) return { error: t("categoryNameRequired") } as const;
  if (!kind) return { error: t("categoryKindRequired") } as const;

  return {
    values: {
      name,
      kind,
      sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      isActive: formData.get("isActive") === "on",
    },
  } as const;
}

export async function createCategory(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  if (!canManageCategories(user)) return { error: t("notAllowed") };

  const parsed = readCategoryFields(formData, t);
  if ("error" in parsed) return parsed;

  try {
    await db.insert(economicCategories).values(parsed.values);
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("categoryNameTaken") };
    throw error;
  }

  return { message: t("categoryCreated") };
}

export async function updateCategory(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  if (!canManageCategories(user)) return { error: t("notAllowed") };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t("categoryNotFound") };

  const parsed = readCategoryFields(formData, t);
  if ("error" in parsed) return parsed;

  try {
    await db.update(economicCategories).set(parsed.values).where(eq(economicCategories.id, id));
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) return { error: t("categoryNameTaken") };
    throw error;
  }

  return { message: t("categoryUpdated") };
}
