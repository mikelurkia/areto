import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * La barra de filtros de un listado: buscador y desplegables a la izquierda,
 * acciones de la pantalla (exportar, imprimir) empujadas a la derecha.
 *
 * Existía ya su esqueleto —`FiltersBarSkeleton` en `skeletons.tsx`— pero no su
 * contraparte de runtime, así que la geometría real estaba copiada a mano en
 * los ocho browsers de la aplicación. Aquí vive una sola vez, y es la que el
 * esqueleto imita: si cambia una, cambia la otra.
 *
 * `trailing` va aparte y no como un hijo más porque el `ml-auto` que lo separa
 * del resto es justo lo que se olvidaba al copiar.
 */
export function FiltersBar({
  children,
  trailing,
  className,
}: {
  children: React.ReactNode;
  /** Acciones a la derecha. No se imprimen. */
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {trailing ? (
        <div className="ml-auto flex items-center gap-2 print:hidden">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
