import { EmptyValue } from "@/components/empty-value";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Ejecución sobre lo presupuestado. La barra se recorta al 100 % aunque el
 * porcentaje siga subiendo, que es lo que hace visible el exceso.
 *
 * Solo se colorea pasarse del presupuesto, nunca ir por debajo: en septiembre
 * no hay ni un ingreso cobrado todavía, y teñir de rojo la tabla entera no
 * dice nada de la salud del club.
 *
 * Compartido entre `BudgetEditor` (tabla de presupuesto) y el resumen del
 * módulo económico.
 */
export function ExecutionBar({
  kind,
  pct,
  label,
  className,
}: {
  kind: "income" | "expense";
  pct: number | null;
  label: string;
  className?: string;
}) {
  if (pct === null) return <EmptyValue />;

  const over = pct > 100;
  const adverse = over && kind === "expense";
  const favourable = over && kind === "income";

  return (
    <Progress
      value={Math.min(pct, 100)}
      aria-label={label}
      className={cn(
        "gap-1",
        adverse && "[&_[data-slot=progress-indicator]]:bg-destructive",
        favourable && "[&_[data-slot=progress-indicator]]:bg-success",
        className,
      )}
    >
      <span
        className={cn(
          "ml-auto text-xs tabular-nums",
          adverse ? "text-destructive" : favourable ? "text-success" : "text-muted-foreground",
        )}
      >
        {Math.round(pct)}%
      </span>
    </Progress>
  );
}
