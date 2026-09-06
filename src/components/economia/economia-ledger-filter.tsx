import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LEDGER_FILTER_VALUES, LEDGER_PARAM, type Ledger, type LedgerFilter } from "@/lib/economia";

/**
 * Segmented control de 3 estados (Oficial/Interno/Ambos) para las pantallas
 * que mezclan filas de los dos libros. Solo se pinta con los dos libros
 * visibles — igual que el switcher de 2 botones que sustituye en
 * `EconomiaSectionNav`.
 */
export async function EconomiaLedgerFilter({
  href,
  filter,
  visible,
  values = LEDGER_FILTER_VALUES,
}: {
  href: string;
  filter: LedgerFilter;
  visible: readonly Ledger[];
  /** Subconjunto de valores a ofrecer — p. ej. sin "both" en pantallas de edición. */
  values?: readonly LedgerFilter[];
}) {
  if (visible.length < 2) return null;
  const t = await getTranslations("Economia");

  return (
    <>
      {values.map((value) => (
        <Button
          key={value}
          size="sm"
          variant={value === filter ? "secondary" : "ghost"}
          aria-current={value === filter ? "true" : undefined}
          nativeButton={false}
          render={<Link href={`${href}?${LEDGER_PARAM}=${value}`} />}
        >
          {t(`ledger_${value}`)}
        </Button>
      ))}
    </>
  );
}
