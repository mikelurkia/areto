import type { LucideIcon } from "lucide-react";

import { SectionHeading } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { TONE_ICON, type StatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export type NeedsAttentionItem = {
  id: string;
  icon: LucideIcon;
  tone: StatusTone;
  label: string;
  hint?: string;
  href?: string;
  /** Libro del que sale la fila; solo se pinta si el usuario ve los dos. */
  ledgerLabel?: string;
  /** Fecha ISO por la que ordenar dentro de un mismo tono. */
  date: string;
};

/** Lo urgente primero: un vencido de hace un mes pesa más que una remesa de mañana. */
const TONE_ORDER: Record<StatusTone, number> = {
  danger: 0,
  warning: 1,
  highlight: 2,
  positive: 3,
  neutral: 4,
};

/** Ordena la mezcla de los dos libros: por urgencia y, dentro de ella, por fecha. */
export function sortNeedsAttention(items: NeedsAttentionItem[]): NeedsAttentionItem[] {
  return [...items].sort(
    (a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.date.localeCompare(b.date),
  );
}

/**
 * Lo pendiente de los dos libros en una sola lista, arriba del resumen.
 *
 * Antes cada tarjeta de libro llevaba la suya: había que leer dos veces para
 * saber qué es lo siguiente que hay que hacer, que es justo la pregunta que
 * trae a alguien a esta página.
 */
export function NeedsAttentionCard({
  heading,
  emptyLabel,
  items,
}: {
  heading: string;
  emptyLabel: string;
  items: NeedsAttentionItem[];
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <SectionHeading as="h2" title={heading} />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col">
            {items.map((item) => {
              const Icon = item.icon;
              const row = (
                <div className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center",
                      TONE_ICON[item.tone],
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.label}</p>
                    {item.hint ? (
                      <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                    ) : null}
                  </div>
                  {item.ledgerLabel ? (
                    <StatusBadge tone="neutral" label={item.ledgerLabel} />
                  ) : null}
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
      </CardContent>
    </Card>
  );
}
