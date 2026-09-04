"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  accountMovements,
  financialAccounts,
  movementLinks,
  sepaRemittances,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { FOREIGN_KEY_VIOLATION, isPostgresError } from "@/lib/db-errors";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  canManageLedger,
  reconciliationState,
} from "@/lib/economia";
import { readAmountCents } from "@/lib/money";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Campos del formulario de apunte. El libro NO se lee del formulario: lo pone
 * la cuenta elegida, que es quien lo conoce (`accountLedger`), y contra él se
 * comprueba el permiso de escritura.
 */
function readMovementFields(formData: FormData, t: Translator) {
  const accountId = String(formData.get("accountId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const bookedOn = String(formData.get("bookedOn") ?? "").trim();
  const valueOn = String(formData.get("valueOn") ?? "").trim();
  const concept = String(formData.get("concept") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  // "none" es el valor del "sin categoría" del desplegable (convención del proyecto).
  const categoryId = String(formData.get("categoryId") ?? "");
  const amountCents = readAmountCents(formData.get("amount"));
  const balanceCents = readAmountCents(formData.get("balance"));

  if (!accountId) return { error: t("movementAccountRequired") } as const;
  if (!seasonId) return { error: t("movementSeasonRequired") } as const;
  if (!bookedOn) return { error: t("movementBookedOnRequired") } as const;
  if (!concept) return { error: t("movementConceptRequired") } as const;
  // Un apunte de cero no dice nada y descuadra el saldo sin que se note.
  if (amountCents === null || amountCents === 0) {
    return { error: t("movementAmountRequired") } as const;
  }

  return {
    accountId,
    values: {
      seasonId,
      bookedOn,
      valueOn: valueOn || null,
      amountCents,
      concept,
      counterparty: counterparty || null,
      balanceCents,
      categoryId: categoryId && categoryId !== "none" ? categoryId : null,
      notes: notes || null,
    },
  } as const;
}

/** Libro de la cuenta elegida, o `null` si esa cuenta ya no existe. */
async function ledgerOfAccount(accountId: string) {
  const account = await db.query.financialAccounts.findFirst({
    where: eq(financialAccounts.id, accountId),
    columns: { ledger: true },
  });
  return account?.ledger ?? null;
}

export async function createMovement(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const parsed = readMovementFields(formData, t);
  if ("error" in parsed) return parsed;

  const ledger = await ledgerOfAccount(parsed.accountId);
  if (!ledger) return { error: t("accountNotFound") };
  if (!canManageLedger(user, ledger)) return { error: t("notAllowed") };

  const [created] = await db
    .insert(accountMovements)
    .values({ ...parsed.values, accountId: parsed.accountId, ledger, source: "manual" })
    .returning({ id: accountMovements.id });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "account_movement",
    entityId: created.id,
    metadata: { ledger, amountCents: parsed.values.amountCents, concept: parsed.values.concept },
  });

  return { message: t("movementCreated") };
}

export async function updateMovement(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.accountMovements.findFirst({
    where: eq(accountMovements.id, id),
    columns: { ledger: true },
  });
  if (!current) return { error: t("movementNotFound") };

  const parsed = readMovementFields(formData, t);
  if ("error" in parsed) return parsed;

  const nextLedger = await ledgerOfAccount(parsed.accountId);
  if (!nextLedger) return { error: t("accountNotFound") };
  // Mover un apunte de libro es sacarlo de uno y meterlo en otro: hacen falta
  // las dos `manage`, igual que al cambiar de libro una cuenta.
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };
  if (nextLedger !== current.ledger && !canManageLedger(user, nextLedger)) {
    return { error: t("notAllowed") };
  }

  await db
    .update(accountMovements)
    .set({ ...parsed.values, accountId: parsed.accountId, ledger: nextLedger })
    .where(eq(accountMovements.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "account_movement",
    entityId: id,
    metadata: { ledger: nextLedger, previousLedger: current.ledger },
  });

  return { message: t("movementUpdated") };
}

export async function deleteMovement(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const id = String(formData.get("id") ?? "");
  const current = await db.query.accountMovements.findFirst({
    where: eq(accountMovements.id, id),
    columns: { ledger: true, concept: true, amountCents: true },
  });
  if (!current) return { error: t("movementNotFound") };
  if (!canManageLedger(user, current.ledger)) return { error: t("notAllowed") };

  await db.delete(accountMovements).where(eq(accountMovements.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "account_movement",
    entityId: id,
    metadata: {
      ledger: current.ledger,
      concept: current.concept,
      amountCents: current.amountCents,
    },
  });

  return { message: t("movementDeleted") };
}

// ---------------------------------------------------------------------------
// Conciliación de ingresos: el apunte AGREGADO de una remesa SEPA
// ---------------------------------------------------------------------------

/**
 * El banco abona una remesa como un único apunte, así que la conciliación de
 * ingresos por cuotas se hace contra `sepa_remittances`, no cargo a cargo.
 * `settledOn` se deriva de los enlaces: en cuanto suman el total congelado de
 * la remesa, queda abonada con la fecha del apunte más reciente.
 */
async function syncRemittanceSettlement(remittanceId: string) {
  const remittance = await db.query.sepaRemittances.findFirst({
    where: eq(sepaRemittances.id, remittanceId),
    columns: { totalCents: true },
    with: { links: { with: { movement: { columns: { bookedOn: true } } } } },
  });
  if (!remittance) return;

  const linked = remittance.links.reduce((sum, l) => sum + l.amountCents, 0);
  const settled = reconciliationState(linked, remittance.totalCents) === "settled";
  const settledOn = settled
    ? remittance.links.map((l) => l.movement.bookedOn).sort().at(-1)!
    : null;

  await db
    .update(sepaRemittances)
    .set({ settledOn })
    .where(eq(sepaRemittances.id, remittanceId));
}

export async function linkMovementToRemittance(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const movementId = String(formData.get("movementId") ?? "");
  const sepaRemittanceId = String(formData.get("sepaRemittanceId") ?? "");
  const amountCents = readAmountCents(formData.get("amount"));
  if (!movementId || !sepaRemittanceId) return { error: t("notAllowed") };
  if (amountCents === null || amountCents === 0) return { error: t("movementAmountRequired") };

  const movement = await db.query.accountMovements.findFirst({
    where: eq(accountMovements.id, movementId),
    columns: { ledger: true },
  });
  if (!movement) return { error: t("movementNotFound") };
  if (!canManageLedger(user, movement.ledger)) return { error: t("notAllowed") };

  try {
    await db.insert(movementLinks).values({ movementId, sepaRemittanceId, amountCents });
  } catch (error) {
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) return { error: t("notAllowed") };
    throw error;
  }
  await syncRemittanceSettlement(sepaRemittanceId);

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "movement_link",
    entityId: movementId,
    metadata: { sepaRemittanceId, amountCents },
  });

  revalidateRoutes(ROUTE.cuotaFicha);
  return { message: t("linkCreated") };
}

export async function unlinkRemittanceMovement(
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
  if (!link?.sepaRemittanceId) return { error: t("notAllowed") };
  if (!canManageLedger(user, link.movement.ledger)) return { error: t("notAllowed") };

  await db.delete(movementLinks).where(eq(movementLinks.id, id));
  await syncRemittanceSettlement(link.sepaRemittanceId);

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "movement_link",
    entityId: id,
    metadata: { sepaRemittanceId: link.sepaRemittanceId },
  });

  revalidateRoutes(ROUTE.cuotaFicha);
  return { message: t("linkDeleted") };
}
