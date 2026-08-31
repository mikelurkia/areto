import type * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * La barra que aparece sobre un listado cuando hay filas marcadas: cuántas
 * son, qué se puede hacer con ellas y cómo soltarlas.
 *
 * Estaba copiada en tres pantallas (`personas`, `socios`, renovaciones de
 * temporada) con el mismo `rounded-lg border bg-muted/50 p-2` escrito a mano.
 *
 * `count` y `onClear` son props y no `children` porque son las dos únicas
 * partes que todas las copias tenían en común: el recuento abre la barra y
 * «quitar selección» la cierra, siempre en los mismos extremos.
 */
export function BulkActionsBar({
  countLabel,
  clearLabel,
  onClear,
  children,
  className,
}: {
  /** Ya traducido, con su recuento dentro ("12 seleccionadas"). */
  countLabel: string;
  clearLabel: string;
  onClear: () => void;
  /** Las acciones propias de la pantalla. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2 print:hidden",
        className,
      )}
    >
      <span className="text-sm font-medium">{countLabel}</span>
      {children}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  );
}
