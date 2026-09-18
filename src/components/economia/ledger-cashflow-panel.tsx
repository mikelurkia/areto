import { PiggyBankIcon } from "lucide-react";

import { CashflowTimelineChart } from "@/components/economia/cashflow-timeline-chart";
import { SectionHeading } from "@/components/page-header";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Panel de un libro en el resumen: saldo de las cuentas y proyección de caja.
 * Una idea por tarjeta — lo pendiente vive en `NeedsAttentionCard`, una sola
 * vez para los dos libros, y la ejecución del presupuesto en su pestaña.
 *
 * Recibe todo ya traducido y formateado — no llama a `getTranslations`, para
 * poder montar dos instancias (oficial/interno) desde la misma página sin
 * duplicar esa carga.
 */
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
      </CardContent>
    </Card>
  );
}
