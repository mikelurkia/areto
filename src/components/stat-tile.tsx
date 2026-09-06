import type * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status-tone";

/*
 * La casilla de dato: etiqueta apagada arriba, cifra grande debajo.
 *
 * Estaba copiada literalmente en los KPI de patrocinadores (listado y ficha)
 * con el mismo `rounded-lg border p-4` a mano. Aquí es una `Card size="sm"`,
 * que es el contenedor canónico de sección desde esta etapa.
 *
 * El valor entra **ya formateado**: el `Intl.NumberFormat` con la moneda y el
 * locale vive en la página, que es quien conoce el idioma de la petición. La
 * cifra usa `font-heading` (la misma fuente condensada de los títulos, no la
 * de cuerpo) para que se lea como un dato destacado y no como texto corrido.
 */

// Mismo vocabulario que StatusBadge (`lib/status-tone.ts`), pero en icono +
// chapa de fondo en vez de badge: aquí no hay una "etiqueta de estado", sino
// una cifra que el tono ayuda a jerarquizar (cobrado vs. pendiente vs. total).
const TONE_ICON_CHIP: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/10 text-muted-foreground",
  positive: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  highlight: "bg-gold/10 text-gold",
};

export type StatTileProps = {
  /** Ya traducida. */
  label: string;
  /** Ya formateado por quien llama (`Intl`, "—" si no hay dato). */
  value: React.ReactNode;
  /** Segunda línea, para el desglose de la cifra. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Tono semántico de la cifra (cobrado, pendiente, total…). Por defecto, neutro. */
  tone?: StatusTone;
  className?: string;
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: StatTileProps) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="flex items-start gap-2.5">
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              TONE_ICON_CHIP[tone],
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-xl leading-tight font-bold tabular-nums">
            {value}
          </p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Fila de KPIs. Único sitio donde vive la disposición del grid: estaba
 * repetida a mano (`grid gap-3 sm:grid-cols-2 lg:grid-cols-4`) en cada página
 * que monta una fila de `StatTile`.
 */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
