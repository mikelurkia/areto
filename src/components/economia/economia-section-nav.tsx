import { LockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LEDGER_PARAM, LEDGERS, type Ledger } from "@/lib/economia";
import { cn } from "@/lib/utils";

export type EconomiaSection = "resumen" | "movimientos" | "recibidas" | "proveedores" | "cuentas";

const SECTIONS: { key: EconomiaSection; href: string }[] = [
  { key: "resumen", href: "/economia" },
  { key: "movimientos", href: "/economia/movimientos" },
  { key: "recibidas", href: "/economia/recibidas" },
  { key: "proveedores", href: "/economia/proveedores" },
  { key: "cuentas", href: "/economia/cuentas" },
];

/**
 * Sub-navegación del módulo económico, con el selector de libro a la derecha.
 *
 * Copia el patrón de `AdminSectionNav`: Server Component con la pestaña activa
 * por prop (leer `usePathname` obligaría a un límite de cliente y a un
 * `<Suspense>`), `aria-current` + `border-b-2` para marcarla.
 *
 * El libro viaja en la URL, así que cada pestaña lo arrastra. Con un solo libro
 * visible no se pinta selector — quien solo tiene `economia.official.view` no
 * llega ni a saber que existe el otro.
 */
export async function EconomiaSectionNav({
  current,
  ledger,
  visible,
}: {
  current: EconomiaSection;
  ledger: Ledger;
  visible: readonly Ledger[];
}) {
  const t = await getTranslations("Economia");
  const showSwitcher = visible.length > 1;

  const withLedger = (href: string, value: Ledger) =>
    showSwitcher ? `${href}?${LEDGER_PARAM}=${value}` : href;

  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b">
      <nav className="flex gap-1">
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={withLedger(section.href, ledger)}
            aria-current={section.key === current ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              section.key === current
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`nav_${section.key}`)}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2 pb-2">
        {ledger === "internal" ? (
          <StatusBadge tone="warning" icon={LockIcon} label={t("internalLedgerBadge")} />
        ) : null}
        {showSwitcher
          ? LEDGERS.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={value === ledger ? "secondary" : "ghost"}
                aria-current={value === ledger ? "true" : undefined}
                nativeButton={false}
                render={
                  <Link
                    href={withLedger(
                      SECTIONS.find((s) => s.key === current)!.href,
                      value,
                    )}
                  />
                }
              >
                {t(`ledger_${value}`)}
              </Button>
            ))
          : null}
      </div>
    </div>
  );
}
