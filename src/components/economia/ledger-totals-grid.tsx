import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/status-badge";
import { TableCell, TableHead } from "@/components/ui/table";
import type { Ledger } from "@/lib/economia";
import { cn } from "@/lib/utils";

/**
 * Cabecera de totales de los "browser" de economía: una tarjeta por libro
 * cuando `filter` es "both" (con su badge de libro), o una sola sin badge
 * cuando se está viendo un único libro. El contenido de cada tarjeta (los
 * `StatTile` concretos) lo decide cada "browser", que es lo único que varía
 * entre ellos.
 */
export function LedgerTotalsGrid<T>({
  entries,
  showLedgerColumn,
  renderStats,
}: {
  entries: [Ledger, T][];
  showLedgerColumn: boolean;
  renderStats: (totals: T) => React.ReactNode;
}) {
  const t = useTranslations("Economia");
  return (
    <div className={cn("grid gap-4", showLedgerColumn && "md:grid-cols-2")}>
      {entries.map(([ledger, totals]) => (
        <div key={ledger} className="flex flex-col gap-2">
          {showLedgerColumn ? (
            <StatusBadge tone="neutral" label={t(`ledger_${ledger}`)} />
          ) : null}
          {renderStats(totals)}
        </div>
      ))}
    </div>
  );
}

/** Celda vacía de cabecera para la columna de libro, cuando `filter` es "both". */
export function LedgerColumnHead({ show }: { show: boolean }) {
  if (!show) return null;
  return <TableHead priority="tertiary" />;
}

/** Badge de libro en la fila, cuando `filter` es "both". */
export function LedgerColumnCell({ show, ledger }: { show: boolean; ledger: Ledger }) {
  const t = useTranslations("Economia");
  if (!show) return null;
  return (
    <TableCell priority="tertiary">
      <StatusBadge tone="neutral" label={t(`ledger_${ledger}`)} />
    </TableCell>
  );
}
