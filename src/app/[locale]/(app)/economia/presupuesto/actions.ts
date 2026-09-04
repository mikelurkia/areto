"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { budgetLines, economicCategories, seasonBudgets } from "@/db/schema";
import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGERS,
  canManageLedger,
  type Ledger,
} from "@/lib/economia";
import { readAmountCents } from "@/lib/money";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

function readLedger(formData: FormData): Ledger | null {
  const value = String(formData.get("ledger") ?? "");
  return (LEDGERS as readonly string[]).includes(value) ? (value as Ledger) : null;
}

/**
 * Guarda todas las líneas del presupuesto de una tacada: la pantalla es una
 * tabla con una casilla por categoría y un solo botón, no un diálogo por línea.
 *
 * Un importe vacío o cero borra la línea — "no presupuestado" y "cero" son lo
 * mismo de cara al informe, y así la tabla no se llena de filas a cero.
 */
export async function saveBudgetLines(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const ledger = readLedger(formData);
  const seasonId = String(formData.get("seasonId") ?? "");
  if (!ledger || !seasonId || !canManageLedger(user, ledger)) return { error: t("notAllowed") };

  // Los importes vienen como `line_<categoryId>`; se contrastan contra el
  // catálogo para no aceptar un id inventado desde el formulario.
  const submitted = new Map<string, number>();
  const blanks: string[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("line_")) continue;
    const categoryId = key.slice("line_".length);
    const cents = readAmountCents(raw);
    if (cents === null) {
      if (String(raw ?? "").trim()) return { error: t("budgetAmountInvalid") };
      blanks.push(categoryId);
      continue;
    }
    if (cents === 0) blanks.push(categoryId);
    else submitted.set(categoryId, cents);
  }

  const ids = [...submitted.keys(), ...blanks];
  if (ids.length > 0) {
    const known = await db.query.economicCategories.findMany({
      where: inArray(economicCategories.id, ids),
      columns: { id: true },
    });
    if (known.length !== ids.length) return { error: t("categoryNotFound") };
  }

  const existing = await db.query.seasonBudgets.findFirst({
    where: and(eq(seasonBudgets.seasonId, seasonId), eq(seasonBudgets.ledger, ledger)),
    columns: { id: true, status: true },
  });
  if (existing?.status === "approved") return { error: t("budgetLocked") };

  const budgetId = await db.transaction(async (tx) => {
    const id =
      existing?.id ??
      (
        await tx
          .insert(seasonBudgets)
          .values({ seasonId, ledger })
          .returning({ id: seasonBudgets.id })
      )[0].id;

    if (blanks.length > 0) {
      await tx
        .delete(budgetLines)
        .where(and(eq(budgetLines.budgetId, id), inArray(budgetLines.categoryId, blanks)));
    }

    if (submitted.size > 0) {
      await tx
        .insert(budgetLines)
        .values(
          [...submitted].map(([categoryId, plannedCents]) => ({
            budgetId: id,
            categoryId,
            plannedCents,
          })),
        )
        .onConflictDoUpdate({
          target: [budgetLines.budgetId, budgetLines.categoryId],
          set: { plannedCents: sql`excluded.planned_cents` },
        });
    }

    return id;
  });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "season_budget",
    entityId: budgetId,
    metadata: { ledger, seasonId, lines: submitted.size },
  });

  revalidateRoutes(ROUTE.economiaPresupuesto);
  return { message: t("budgetSaved") };
}

/**
 * Aprueba o reabre el presupuesto. Aprobado significa congelado: las líneas
 * dejan de editarse hasta que alguien con `manage` del libro lo reabre, y las
 * dos transiciones quedan en `audit_log`.
 */
export async function setBudgetStatus(
  _prev: EconomiaState,
  formData: FormData,
): Promise<EconomiaState> {
  const t = await getTranslations("Economia");
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);

  const ledger = readLedger(formData);
  const seasonId = String(formData.get("seasonId") ?? "");
  const approve = String(formData.get("status") ?? "") === "approved";
  if (!ledger || !seasonId || !canManageLedger(user, ledger)) return { error: t("notAllowed") };

  const budget = await db.query.seasonBudgets.findFirst({
    where: and(eq(seasonBudgets.seasonId, seasonId), eq(seasonBudgets.ledger, ledger)),
    columns: { id: true },
  });
  if (!budget) return { error: t("budgetNotFound") };

  await db
    .update(seasonBudgets)
    .set({
      status: approve ? "approved" : "draft",
      approvedOn: approve ? new Date().toISOString().slice(0, 10) : null,
    })
    .where(eq(seasonBudgets.id, budget.id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: approve ? "approve" : "update",
    entityType: "season_budget",
    entityId: budget.id,
    metadata: { ledger, seasonId, status: approve ? "approved" : "draft" },
  });

  revalidateRoutes(ROUTE.economiaPresupuesto);
  return { message: approve ? t("budgetApproved") : t("budgetReopened") };
}
