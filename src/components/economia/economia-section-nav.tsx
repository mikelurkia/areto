import { LockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EconomiaLedgerFilter } from "@/components/economia/economia-ledger-filter";
import { EconomiaSettingsMenu } from "@/components/economia/economia-settings-menu";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import {
  LEDGERS,
  LEDGER_FILTER_VALUES,
  LEDGER_PARAM,
  type Ledger,
  type LedgerFilter,
} from "@/lib/economia";
import { cn } from "@/lib/utils";

export type EconomiaSection =
  | "resumen"
  | "pagos"
  | "presupuesto"
  | "movimientos"
  | "recibidas"
  | "tickets"
  | "emitidas"
  | "proveedores"
  | "cuentas";

/**
 * Qué valores de libro acepta una sección. Es lo único que hace falta saber
 * para pintar su control y para decidir con qué `?libro=` se entra desde otra
 * pestaña: antes eran un flag (`bothLedgers`), una prop (`showLedgerControls`)
 * y un slot (`ledgerFilterSlot`) repartidos por nueve páginas.
 */
type LedgerScope =
  /** Mezcla los dos libros en una tabla: Oficial / Interno / Ambos. */
  | "filter"
  /** Trabaja sobre un libro concreto: Oficial / Interno. */
  | "single"
  /** Ni filtra ni se pinta control (resumen enseña los dos; proveedores son compartidos). */
  | "none";

type SectionDef = { key: EconomiaSection; href: string; scope: LedgerScope };

/** Trabajo diario: la fila de pestañas. */
const SECTIONS: SectionDef[] = [
  { key: "resumen", href: "/economia", scope: "none" },
  { key: "pagos", href: "/economia/pagos", scope: "filter" },
  { key: "presupuesto", href: "/economia/presupuesto", scope: "single" },
  { key: "movimientos", href: "/economia/movimientos", scope: "filter" },
  { key: "recibidas", href: "/economia/recibidas", scope: "filter" },
  { key: "tickets", href: "/economia/tickets", scope: "filter" },
  { key: "emitidas", href: "/economia/emitidas", scope: "filter" },
];

/** Catálogos de temporada: viven en el menú de ajustes, no en las pestañas. */
const SETTINGS_SECTIONS: SectionDef[] = [
  { key: "proveedores", href: "/economia/proveedores", scope: "none" },
  { key: "cuentas", href: "/economia/cuentas", scope: "single" },
];

const ALL_SECTIONS = [...SECTIONS, ...SETTINGS_SECTIONS];

/**
 * Sub-navegación del módulo económico, con el selector de libro a la derecha.
 *
 * Copia el patrón de `AdminSectionNav`: Server Component con la pestaña activa
 * por prop (leer `usePathname` obligaría a un límite de cliente y a un
 * `<Suspense>`), `aria-current` + `border-b-2` para marcarla.
 *
 * El libro viaja en la URL y cada destino lo recorta a lo que sabe entender
 * (`clampToScope`), así que navegar nunca encierra al usuario en un libro que
 * no había elegido ni le lleva a un `?libro=both` que la página no soporta.
 * Con un solo libro visible no se pinta selector — quien solo tiene
 * `economia.official.view` no llega ni a saber que existe el otro.
 */
export async function EconomiaSectionNav({
  current,
  ledger,
  visible,
}: {
  current: EconomiaSection;
  /** El libro (o filtro "ambos") activo, tal como lo resolvió la página. */
  ledger: LedgerFilter;
  visible: readonly Ledger[];
}) {
  const t = await getTranslations("Economia");
  const bothVisible = visible.length > 1;

  const currentSection = ALL_SECTIONS.find((section) => section.key === current)!;

  /**
   * El libro con el que se entra en cada destino. Una sección que mezcla los
   * dos libros se entra siempre por "ambos" —venir de resumen o de cuentas no
   * puede encerrarte en el oficial, que es el único que esas saben decir—, y
   * una de un solo libro nunca recibe un "ambos" que no sabría resolver.
   */
  const ledgerFor = (scope: LedgerScope): LedgerFilter =>
    scope === "filter" ? "both" : ledger === "both" ? visible[0] : ledger;

  const hrefFor = (section: SectionDef) =>
    bothVisible && section.scope !== "none"
      ? `${section.href}?${LEDGER_PARAM}=${ledgerFor(section.scope)}`
      : section.href;

  const scope = currentSection.scope;
  const showFilter = bothVisible && scope !== "none";

  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b">
      <nav className="flex gap-1">
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={hrefFor(section)}
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
        {/* Sin selector, el badge es lo único que avisa de que esto es el libro
            interno; con él, el propio control ya lo está diciendo. */}
        {!showFilter && ledger === "internal" && scope !== "none" ? (
          <StatusBadge tone="warning" icon={LockIcon} label={t("internalLedgerBadge")} />
        ) : null}
        {showFilter ? (
          <EconomiaLedgerFilter
            href={currentSection.href}
            filter={ledger}
            visible={visible}
            values={scope === "filter" ? LEDGER_FILTER_VALUES : LEDGERS}
          />
        ) : null}
        <EconomiaSettingsMenu
          label={t("nav_ajustes")}
          activeKey={current}
          items={SETTINGS_SECTIONS.map((section) => ({
            key: section.key,
            label: t(`nav_${section.key}`),
            href: hrefFor(section),
          }))}
        />
      </div>
    </div>
  );
}
