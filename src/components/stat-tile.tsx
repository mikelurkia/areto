import type * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/*
 * La casilla de dato: etiqueta apagada arriba, cifra grande debajo.
 *
 * Estaba copiada literalmente en los KPI de patrocinadores (listado y ficha)
 * con el mismo `rounded-lg border p-4` a mano. Aquí es una `Card size="sm"`,
 * que es el contenedor canónico de sección desde esta etapa.
 *
 * El valor entra **ya formateado**: el `Intl.NumberFormat` con la moneda y el
 * locale vive en la página, que es quien conoce el idioma de la petición.
 */

export type StatTileProps = {
  /** Ya traducida. */
  label: string;
  /** Ya formateado por quien llama (`Intl`, "—" si no hay dato). */
  value: React.ReactNode;
  /** Segunda línea, para el desglose de la cifra. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: StatTileProps) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="flex items-start gap-3">
        {Icon ? (
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
