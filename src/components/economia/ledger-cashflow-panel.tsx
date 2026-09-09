import type { LucideIcon } from "lucide-react";
import { PiggyBankIcon } from "lucide-react";

import { CashflowTimelineChart } from "@/components/economia/cashflow-timeline-chart";
import { ExecutionBar } from "@/components/economia/execution-bar";
import { SectionHeading } from "@/components/page-header";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { StatusTone } from "@/lib/status-tone";
import { TONE_ICON } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/**
 * Panel de un libro en el resumen: saldo, línea de tiempo de caja y "necesita
 * atención" juntos, en vez de tres bloques sueltos filtrados por `?libro=`
 * (dirección "tablero de libros paralelos + flujo de caja" del rediseño).
 * Recibe todo ya traducido y formateado — no llama a `getTranslations`, para
 * poder montar dos instancias (oficial/interno) desde la misma página sin
 * duplicar esa carga.
 */

export type NeedsAttentionItem = {
  id: string;
  icon: LucideIcon;
  tone: StatusTone;
  label: string;
  hint?: string;
  href?: string;
};

export type BudgetRow = {
  kind: "income" | "expense";
  label: string;
  figures: string;
  pct: number | null;
};

export function LedgerCashflowPanel({
  title,
  internalBadgeLabel,
  totalBalanceLabel,
  totalBalanceValue,
  accounts,
  cashflowHeading,
  cashflowHint,
  cashflowData,
  locale,
  incomeLabel,
  expenseLabel,
  projectedBalanceLabel,
  budgetHeading,
  budgetHint,
  budgetRows,
  needsAttentionHeading,
  needsAttentionEmpty,
  needsAttentionItems,
  className,
}: {
  title: string;
  internalBadgeLabel?: string;
  totalBalanceLabel: string;
  totalBalanceValue: string;
  accounts: { id: string; name: string; value: string; hint?: string }[];
  cashflowHeading: string;
  cashflowHint: string;
  cashflowData: {
    weekLabel: string;
    incomeCents: number;
    expenseCents: number;
    projectedBalanceCents: number;
  }[];
  locale: string;
  incomeLabel: string;
  expenseLabel: string;
  projectedBalanceLabel: string;
  budgetHeading: string;
  budgetHint: string;
  budgetRows: BudgetRow[] | null;
  needsAttentionHeading: string;
  needsAttentionEmpty: string;
  needsAttentionItems: NeedsAttentionItem[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          {internalBadgeLabel ? (
            <StatusBadge tone="warning" label={internalBadgeLabel} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <StatGrid className="sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label={totalBalanceLabel}
            value={totalBalanceValue}
            icon={PiggyBankIcon}
            tone="highlight"
          />
          {accounts.map((account) => (
            <StatTile key={account.id} label={account.name} value={account.value} hint={account.hint} />
          ))}
        </StatGrid>

        <div className="flex flex-col gap-3">
          <SectionHeading as="h3" title={cashflowHeading} description={cashflowHint} />
          <CashflowTimelineChart
            data={cashflowData}
            locale={locale}
            incomeLabel={incomeLabel}
            expenseLabel={expenseLabel}
            projectedBalanceLabel={projectedBalanceLabel}
          />
        </div>

        {budgetRows ? (
          <div className="flex flex-col gap-3">
            <SectionHeading as="h3" title={budgetHeading} description={budgetHint} />
            <div className="flex flex-col gap-4">
              {budgetRows.map((row) => (
                <div key={row.kind} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm font-medium">{row.label}</span>
                    <span className="text-xs text-muted-foreground">{row.figures}</span>
                  </div>
                  <ExecutionBar kind={row.kind} pct={row.pct} label={row.label} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <SectionHeading as="h3" title={needsAttentionHeading} />
          {needsAttentionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{needsAttentionEmpty}</p>
          ) : (
            <div className="flex flex-col gap-0">
              {needsAttentionItems.map((item) => {
                const Icon = item.icon;
                const row = (
                  <div className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0">
                    <span className={cn("flex size-6 shrink-0 items-center justify-center", TONE_ICON[item.tone])}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.label}</p>
                      {item.hint ? (
                        <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                      ) : null}
                    </div>
                  </div>
                );
                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="-mx-(--card-spacing) rounded-md px-(--card-spacing) hover:bg-muted/40"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={item.id}>{row}</div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
