import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Ancho de cada control de la fila de filtros, en el orden en que se pintan. */
const FILTER_WIDTHS = ["w-48", "w-40", "w-40", "w-40"];

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* La acción de la derecha es "imprimir", solo en la vista de lista. */}
      <PageHeaderSkeleton actions={1} />

      {/*
        Los filtros del calendario no son la barra de los listados: cada control
        lleva su etiqueta encima y a la derecha va el conmutador lista/mes. Con
        `FiltersBarSkeleton` la fila quedaba más baja y el contenido saltaba.
      */}
      <div className="flex flex-wrap items-end justify-between gap-4" aria-hidden>
        <div className="flex flex-wrap items-end gap-3">
          {FILTER_WIDTHS.map((width, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className={`h-8 ${width}`} />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      <TableSkeleton
        columns={[
          "w-32",
          { width: "w-20", priority: "secondary" },
          "w-32",
          { width: "w-28", priority: "tertiary" },
          { width: "w-40", priority: "tertiary" },
          "w-16",
        ]}
        rows={6}
      />
    </div>
  );
}
