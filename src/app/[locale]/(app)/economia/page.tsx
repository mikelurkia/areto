import { LandmarkIcon, PiggyBankIcon } from "lucide-react";
import { and, asc, eq, sum } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import {
  accountMovements,
  financialAccounts,
  issuedInvoices,
  receivedInvoices,
  seasonBudgets,
  seasons,
} from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { ExecutionBar } from "@/components/economia/execution-bar";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  resolveLedger,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economia") };
}

export default async function EconomiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);
  const ledger = resolveLedger((await searchParams)[LEDGER_PARAM], visible)!;

  // El filtro por libro va en el `where`, nunca en el render: pedir
  // `?libro=internal` sin el permiso cae en el libro oficial y no trae ni una
  // fila del otro.
  const accounts = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.ledger, ledger),
    orderBy: [asc(financialAccounts.name)],
  });

  // Agregación aparte de la query directa de arriba, no dentro de un
  // `Promise.all` con ella (convención de concurrencia del proyecto).
  const movementTotals = await db
    .select({
      accountId: accountMovements.accountId,
      totalCents: sum(accountMovements.amountCents),
    })
    .from(accountMovements)
    .where(eq(accountMovements.ledger, ledger))
    .groupBy(accountMovements.accountId);

  // `sum()` de Postgres llega como texto (numeric), y como `null` si la cuenta
  // no tiene ni un apunte.
  const movedByAccount = new Map(
    movementTotals.map((row) => [row.accountId, Number(row.totalCents ?? 0)]),
  );

  const openAccounts = accounts
    .filter((account) => account.isActive)
    .map((account) => ({
      ...account,
      balanceCents:
        account.openingBalanceCents + (movedByAccount.get(account.id) ?? 0),
    }));
  const totalCents = openAccounts.reduce((total, a) => total + a.balanceCents, 0);

  // Comparativa presupuesto vs. real de la temporada en curso. Cada consulta
  // va en su propio `await`, no en el `Promise.all` de arriba (convención de
  // concurrencia del proyecto).
  const season = await db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true) });

  const budget = season
    ? await db.query.seasonBudgets.findFirst({
        where: and(eq(seasonBudgets.seasonId, season.id), eq(seasonBudgets.ledger, ledger)),
        with: {
          lines: {
            columns: { plannedCents: true },
            with: { category: { columns: { kind: true } } },
          },
        },
      })
    : undefined;

  // Solo las `issued`: una rectificada sigue en el libro, pero el documento
  // vivo es su rectificativa y sumar las dos duplicaría el importe.
  const [accruedIncomeRow] = season
    ? await db
        .select({ total: sum(issuedInvoices.totalCents) })
        .from(issuedInvoices)
        .where(
          and(
            eq(issuedInvoices.ledger, ledger),
            eq(issuedInvoices.seasonId, season.id),
            eq(issuedInvoices.status, "issued"),
          ),
        )
    : [];

  const [accruedExpenseRow] = season
    ? await db
        .select({ total: sum(receivedInvoices.totalCents) })
        .from(receivedInvoices)
        .where(and(eq(receivedInvoices.ledger, ledger), eq(receivedInvoices.seasonId, season.id)))
    : [];

  const plannedByKind = (budget?.lines ?? []).reduce(
    (acc, line) => {
      acc[line.category.kind] += line.plannedCents;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const budgetSummary = season
    ? {
        income: { planned: plannedByKind.income, accrued: Number(accruedIncomeRow?.total ?? 0) },
        expense: {
          planned: plannedByKind.expense,
          accrued: Number(accruedExpenseRow?.total ?? 0),
        },
      }
    : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EconomiaSectionNav current="resumen" ledger={ledger} visible={visible} />

      {openAccounts.length === 0 ? (
        <SectionPlaceholder
          icon={LandmarkIcon}
          title={t("noAccountsTitle")}
          description={t("noAccountsDescription")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SectionHeading
            title={t("balancesHeading")}
            description={t("balancesHint")}
          />
          <StatGrid>
            <StatTile
              label={t("totalBalanceLabel")}
              value={formatCents(totalCents, locale)}
              icon={PiggyBankIcon}
              tone="highlight"
            />
            {openAccounts.map((account) => (
              <StatTile
                key={account.id}
                label={account.name}
                value={formatCents(account.balanceCents, locale)}
                hint={t(`accountKind_${account.kind}`)}
              />
            ))}
          </StatGrid>
        </div>
      )}

      {budgetSummary ? (
        <div className="flex flex-col gap-4">
          <SectionHeading
            title={t("budgetSummaryHeading")}
            description={t("budgetSummaryHint")}
          />
          <Card size="sm">
            <CardContent className="flex flex-col gap-4">
              {(["income", "expense"] as const).map((kind) => {
                const side = budgetSummary[kind];
                const pct = side.planned ? (side.accrued / side.planned) * 100 : null;
                return (
                  <div key={kind} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-sm font-medium">{t(`categoryKind_${kind}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("budgetSummaryFigures", {
                          accrued: formatCents(side.accrued, locale),
                          planned: formatCents(side.planned, locale),
                        })}
                      </span>
                    </div>
                    <ExecutionBar kind={kind} pct={pct} label={t(`categoryKind_${kind}`)} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
