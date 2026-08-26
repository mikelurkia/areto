import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";

export type AlertSeverity = "danger" | "warning";

/**
 * Tarjeta-alerta del panel: un número grande, una etiqueta y poco más. Toda la
 * tarjeta es el enlace a la pantalla donde se resuelve el aviso — el panel no
 * muestra nombres ni fechas, solo cuánto hay pendiente y dónde atenderlo.
 *
 * Solo se pinta cuando hay algo que avisar, así que no tiene estado "cero": lo
 * decide quien la renderiza.
 */
export function AlertTile({
  href,
  icon: Icon,
  count,
  label,
  hint,
  severity,
}: {
  href: string;
  icon: LucideIcon;
  count: number;
  label: string;
  hint?: string;
  severity: AlertSeverity;
}) {
  const isDanger = severity === "danger";
  return (
    <Link href={href} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
      <Card
        className={cn(
          "h-full gap-2 transition-colors",
          isDanger
            ? "bg-destructive/5 ring-destructive/25 hover:bg-destructive/10 dark:bg-destructive/10"
            : "bg-warning/15 ring-warning/40 hover:bg-warning/25",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-(--card-spacing)">
          <span
            className={cn(
              "text-4xl leading-none font-semibold tabular-nums",
              isDanger ? "text-destructive" : "text-foreground",
            )}
          >
            {count}
          </span>
          <Icon
            className={cn(
              "size-5 shrink-0",
              isDanger ? "text-destructive" : "text-foreground/70",
            )}
            aria-hidden
          />
        </div>
        <div className="flex flex-col gap-0.5 px-(--card-spacing)">
          <span className="font-medium">{label}</span>
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </div>
      </Card>
    </Link>
  );
}
