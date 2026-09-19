import { AlertTriangleIcon, FileClockIcon, LandmarkIcon, RefreshCwIcon } from "lucide-react";
import { and, asc, eq, isNull, isNotNull, sum } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import {
  accountMovements,
  financialAccounts,
  receivedInvoices,
  seasonBudgets,
  seasons,
  sepaRemittances,
  sponsorPayments,
} from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { LedgerCashflowPanel } from "@/components/economia/ledger-cashflow-panel";
import {
  NeedsAttentionCard,
  sortNeedsAttention,
  type NeedsAttentionItem,
} from "@/components/economia/needs-attention-card";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  type CashflowEntry,
  type Ledger,
  visibleLedgers,
  weeklyCashflowBuckets,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economia") };
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Todo lo que un panel de libro necesita: saldo, línea de tiempo de caja y
 * "necesita atención". Una llamada por libro, siempre en su propio `await`
 * (ninguna de estas queries entra en un `Promise.all` con otro libro: dos
 * libros a la vez ya duplican las queries de una carga de página).
 */
async function loadLedgerPanel(ledger: Ledger, locale: string, t: Translator) {
  const accounts = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.ledger, ledger),
    orderBy: [asc(financialAccounts.name)],
  });

  const movementTotals = await db
    .select({
      accountId: accountMovements.accountId,
      totalCents: sum(accountMovements.amountCents),
    })
    .from(accountMovements)
    .where(eq(accountMovements.ledger, ledger))
    .groupBy(accountMovements.accountId);

  const movedByAccount = new Map(
    movementTotals.map((row) => [row.accountId, Number(row.totalCents ?? 0)]),
  );

  const openAccounts = accounts
    .filter((account) => account.isActive)
    .map((account) => ({
      ...account,
      balanceCents: account.openingBalanceCents + (movedByAccount.get(account.id) ?? 0),
    }));
  const totalCents = openAccounts.reduce((total, a) => total + a.balanceCents, 0);

  const season = await db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true) });

  // Solo el estado: la ejecución del presupuesto se lee en su pestaña, aquí
  // basta con saber si sigue en borrador para poder avisar.
  const budget = season
    ? await db.query.seasonBudgets.findFirst({
        where: and(eq(seasonBudgets.seasonId, season.id), eq(seasonBudgets.ledger, ledger)),
        columns: { status: true },
      })
    : undefined;

  // Vencimientos pendientes: facturas recibidas de todos los libros, más
  // anualidades de patrocinio y remesas SEPA, que solo existen en el libro
  // oficial. Alimentan tanto el flujo de caja como "necesita atención".
  const pendingInvoices = await db.query.receivedInvoices.findMany({
    where: and(
      eq(receivedInvoices.ledger, ledger),
      eq(receivedInvoices.status, "pending"),
      isNotNull(receivedInvoices.dueDate),
    ),
    orderBy: [asc(receivedInvoices.dueDate)],
    columns: { id: true, dueDate: true, totalCents: true },
    with: { supplier: { columns: { name: true } } },
  });

  const pendingSponsorPayments =
    ledger === "official"
      ? await db.query.sponsorPayments.findMany({
          where: and(eq(sponsorPayments.status, "pending"), isNotNull(sponsorPayments.dueDate)),
          orderBy: [asc(sponsorPayments.dueDate)],
          columns: { id: true, dueDate: true, amountCents: true },
          with: { term: { columns: {}, with: { sponsor: { columns: { name: true } } } } },
        })
      : [];

  const unsettledRemittances =
    ledger === "official"
      ? await db.query.sepaRemittances.findMany({
          where: isNull(sepaRemittances.settledOn),
          orderBy: [asc(sepaRemittances.collectionDate)],
          columns: { id: true, kind: true, collectionDate: true, totalCents: true },
        })
      : [];

  const todayIso = new Date().toISOString().slice(0, 10);

  const cashflowEntries: CashflowEntry[] = [
    ...pendingInvoices.map((row): CashflowEntry => ({
      date: row.dueDate!,
      amountCents: row.totalCents,
      kind: "expense",
    })),
    ...pendingSponsorPayments.map((row): CashflowEntry => ({
      date: row.dueDate!,
      amountCents: row.amountCents,
      kind: "income",
    })),
    ...unsettledRemittances.map((row): CashflowEntry => ({
      date: row.collectionDate,
      amountCents: row.totalCents,
      kind: "income",
    })),
  ];

  const buckets = weeklyCashflowBuckets(totalCents, cashflowEntries);
  const weekFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const cashflowData = buckets.map((bucket) => ({
    weekLabel: weekFmt.format(new Date(bucket.weekStart)),
    incomeCents: bucket.incomeCents,
    expenseCents: bucket.expenseCents,
    projectedBalanceCents: bucket.projectedBalanceCents,
  }));

  const dueDateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const needsAttention: NeedsAttentionItem[] = [
    ...pendingInvoices
      .filter((row) => row.dueDate! < todayIso)
      .map((row): NeedsAttentionItem => ({
        id: `invoice-${row.id}`,
        icon: AlertTriangleIcon,
        tone: "danger",
        label: row.supplier.name,
        hint: t("needsAttentionOverdueHint", { date: dueDateFmt.format(new Date(row.dueDate!)) }),
        href: `/economia/recibidas/${row.id}`,
        date: row.dueDate!,
      })),
    ...unsettledRemittances.map(
      (row): NeedsAttentionItem => ({
        id: `remittance-${row.id}`,
        icon: RefreshCwIcon,
        tone: "warning",
        label: t(`upcomingRemittanceLabel_${row.kind}`),
        hint: t("needsAttentionRemittanceHint", {
          date: dueDateFmt.format(new Date(row.collectionDate)),
        }),
        href: `/cuotas/${row.id}`,
        date: row.collectionDate,
      }),
    ),
    ...(budget && budget.status === "draft"
      ? [
          {
            id: "budget-draft",
            icon: FileClockIcon,
            tone: "warning",
            label: t("needsAttentionDraftBudgetLabel"),
            hint: t("needsAttentionDraftBudgetHint"),
            href: `/economia/presupuesto?libro=${ledger}`,
            date: todayIso,
          } satisfies NeedsAttentionItem,
        ]
      : []),
  ];

  return { openAccounts, totalCents, cashflowData, needsAttention };
}

export default async function EconomiaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);

  // Un panel por libro visible, en su propio `await` cada uno (convención de
  // concurrencia del proyecto: dos libros a la vez duplicarían de golpe las
  // queries de una carga de página).
  const panels: { ledger: Ledger; data: Awaited<ReturnType<typeof loadLedgerPanel>> }[] = [];
  for (const ledger of visible) {
    panels.push({ ledger, data: await loadLedgerPanel(ledger, locale, t) });
  }

  const hasAnyAccounts = panels.some((panel) => panel.data.openAccounts.length > 0);
  const navLedger = visible[0] ?? "official";

  // Una sola lista para los dos libros: la pregunta que trae aquí es "qué hago
  // ahora", y esa no se contesta leyendo dos listas en paralelo.
  const needsAttention = sortNeedsAttention(
    panels.flatMap(({ ledger, data }) =>
      data.needsAttention.map((item) => ({
        ...item,
        ledgerLabel: visible.length > 1 ? t(`ledger_${ledger}`) : undefined,
      })),
    ),
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EconomiaSectionNav current="resumen" ledger={navLedger} visible={visible} />

      {!hasAnyAccounts ? (
        <SectionPlaceholder
          icon={LandmarkIcon}
          title={t("noAccountsTitle")}
          description={t("noAccountsDescription")}
        />
      ) : (
        <>
          <NeedsAttentionCard
            heading={t("needsAttentionHeading")}
            emptyLabel={t("needsAttentionEmpty")}
            items={needsAttention}
          />
          <div className={cn("grid gap-6", panels.length > 1 ? "xl:grid-cols-2" : undefined)}>
            {panels.map(({ ledger, data }) =>
              data.openAccounts.length === 0 ? (
                <Card key={ledger}>
                  <SectionPlaceholder
                    icon={LandmarkIcon}
                    title={t("noAccountsTitle")}
                    description={t("noAccountsDescription")}
                    size="compact"
                  />
                </Card>
              ) : (
                <LedgerCashflowPanel
                  key={ledger}
                  title={t(`ledger_${ledger}`)}
                  internalBadgeLabel={ledger === "internal" ? t("internalLedgerBadge") : undefined}
                  totalBalanceLabel={t("totalBalanceLabel")}
                  totalBalanceValue={formatCents(data.totalCents, locale)}
                  accounts={data.openAccounts.map((account) => ({
                    id: account.id,
                    name: account.name,
                    value: formatCents(account.balanceCents, locale),
                    hint: t(`accountKind_${account.kind}`),
                  }))}
                  cashflowHeading={t("cashflowHeading")}
                  cashflowHint={t("cashflowHint")}
                  cashflowData={data.cashflowData}
                  locale={locale}
                  incomeLabel={t("cashflowIncomeLabel")}
                  expenseLabel={t("cashflowExpenseLabel")}
                  projectedBalanceLabel={t("cashflowProjectedBalanceLabel")}
                />
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
