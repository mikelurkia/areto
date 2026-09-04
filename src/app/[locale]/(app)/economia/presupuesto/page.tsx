import { ScaleIcon, TagsIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { and, asc, desc, eq, sum } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import {
  accountMovements,
  economicCategories,
  issuedInvoices,
  receivedInvoices,
  seasonBudgets,
  seasons,
} from "@/db/schema";
import { BudgetEditor } from "@/components/economia/budget-editor";
import { BudgetStatusActions } from "@/components/economia/budget-status-actions";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { SeasonSelect } from "@/components/equipos/season-select";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  budgetTotals,
  canManageLedger,
  resolveLedger,
  visibleLedgers,
  type BudgetRow,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaPresupuesto") };
}

/** `sum()` de Postgres llega como texto, y como `null` si no hay ni una fila. */
function totalsByCategory(rows: { categoryId: string | null; total: string | null }[]) {
  return new Map(
    rows
      .filter((row) => row.categoryId !== null)
      .map((row) => [row.categoryId!, Number(row.total ?? 0)]),
  );
}

export default async function PresupuestoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string; season?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);

  const [query, allSeasons, categories] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
    db.query.economicCategories.findMany({
      orderBy: [
        asc(economicCategories.kind),
        asc(economicCategories.sortOrder),
        asc(economicCategories.name),
      ],
    }),
  ]);

  // El filtro por libro va en el `where`, nunca en el render: pedir
  // `?libro=internal` sin el permiso cae en el libro oficial.
  const ledger = resolveLedger(query[LEDGER_PARAM], visible)!;
  const canManage = canManageLedger(user, ledger);
  const season =
    allSeasons.find((s) => s.id === query.season) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const budget = season
    ? await db.query.seasonBudgets.findFirst({
        where: and(eq(seasonBudgets.seasonId, season.id), eq(seasonBudgets.ledger, ledger)),
        with: { lines: { columns: { categoryId: true, plannedCents: true } } },
      })
    : undefined;

  // Las tres agregaciones van cada una en su `await`, fuera del `Promise.all`
  // de arriba: acumular consultas concurrentes en una sola carga de página es
  // lo que colgó el dashboard una vez (convención de concurrencia del proyecto).
  const accruedExpense = season
    ? totalsByCategory(
        await db
          .select({
            categoryId: receivedInvoices.categoryId,
            total: sum(receivedInvoices.totalCents),
          })
          .from(receivedInvoices)
          .where(
            and(
              eq(receivedInvoices.ledger, ledger),
              eq(receivedInvoices.seasonId, season.id),
            ),
          )
          .groupBy(receivedInvoices.categoryId),
      )
    : new Map<string, number>();

  // Solo las `issued`: una rectificada sigue en el libro, pero el documento
  // vivo es su rectificativa y sumar las dos duplicaría el importe.
  const accruedIncome = season
    ? totalsByCategory(
        await db
          .select({
            categoryId: issuedInvoices.categoryId,
            total: sum(issuedInvoices.totalCents),
          })
          .from(issuedInvoices)
          .where(
            and(
              eq(issuedInvoices.ledger, ledger),
              eq(issuedInvoices.seasonId, season.id),
              eq(issuedInvoices.status, "issued"),
            ),
          )
          .groupBy(issuedInvoices.categoryId),
      )
    : new Map<string, number>();

  const cash = season
    ? totalsByCategory(
        await db
          .select({
            categoryId: accountMovements.categoryId,
            total: sum(accountMovements.amountCents),
          })
          .from(accountMovements)
          .where(
            and(
              eq(accountMovements.ledger, ledger),
              eq(accountMovements.seasonId, season.id),
            ),
          )
          .groupBy(accountMovements.categoryId),
      )
    : new Map<string, number>();

  const plannedByCategory = new Map(
    (budget?.lines ?? []).map((line) => [line.categoryId, line.plannedCents]),
  );

  // Una categoría retirada a mitad de temporada sigue en la tabla si tiene
  // línea: quitarla escondería dinero ya presupuestado.
  const rows: BudgetRow[] = categories
    .filter((category) => category.isActive || plannedByCategory.has(category.id))
    .map((category) => {
      // El apunte guarda el importe con signo (negativo = cargo); en las
      // categorías de gasto se invierte para poder compararlo con el resto.
      const cashCents = cash.get(category.id) ?? 0;
      return {
        categoryId: category.id,
        name: category.name,
        kind: category.kind,
        isActive: category.isActive,
        plannedCents: plannedByCategory.get(category.id) ?? null,
        accruedCents:
          (category.kind === "income" ? accruedIncome : accruedExpense).get(category.id) ?? 0,
        cashCents: category.kind === "expense" ? -cashCents : cashCents,
      };
    });

  const approved = budget?.status === "approved";
  const totals = budgetTotals(rows);
  // Segunda línea de cada casilla: lo devengado y lo que ha pasado por el banco,
  // que son preguntas distintas y no se suman.
  const realHint = (side: { accrued: number; cash: number }) =>
    `${t("accruedLabel")} ${formatCents(side.accrued, locale)} · ${t("cashLabel")} ${formatCents(
      side.cash,
      locale,
    )}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("budgetTitle")}
        description={t("budgetSubtitle")}
        badges={
          approved ? (
            <StatusBadge tone="positive" label={t("budgetStatus_approved")} />
          ) : (
            <StatusBadge tone="neutral" label={t("budgetStatus_draft")} />
          )
        }
        actions={
          <>
            <SeasonSelect
              seasons={allSeasons}
              selectedId={season?.id ?? ""}
              extraParams={visible.length > 1 ? { [LEDGER_PARAM]: ledger } : undefined}
            />
            {canManage && season && budget ? (
              <BudgetStatusActions
                ledger={ledger}
                seasonId={season.id}
                approved={approved}
              />
            ) : null}
          </>
        }
      />
      <EconomiaSectionNav current="presupuesto" ledger={ledger} visible={visible} />

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t("plannedIncomeLabel")}
            value={formatCents(totals.income.planned, locale)}
            hint={realHint(totals.income)}
            icon={TrendingUpIcon}
          />
          <StatTile
            label={t("plannedExpenseLabel")}
            value={formatCents(totals.expense.planned, locale)}
            hint={realHint(totals.expense)}
            icon={TrendingDownIcon}
          />
          <StatTile
            label={t("plannedResultLabel")}
            value={formatCents(totals.result.planned, locale)}
            icon={ScaleIcon}
          />
          <StatTile
            label={t("actualResultLabel")}
            value={formatCents(totals.result.accrued, locale)}
            hint={`${t("cashLabel")} ${formatCents(totals.result.cash, locale)}`}
          />
        </div>
      ) : null}

      {!season || rows.length === 0 ? (
        <SectionPlaceholder
          icon={TagsIcon}
          title={t("noBudgetCategoriesTitle")}
          description={t("noBudgetCategoriesDescription")}
        />
      ) : (
        <BudgetEditor
          rows={rows}
          ledger={ledger}
          seasonId={season.id}
          editable={canManage && !approved}
          locale={locale}
        />
      )}
    </div>
  );
}
