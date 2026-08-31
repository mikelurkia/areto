import { Skeleton } from "@/components/ui/skeleton";
import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={2} />
      {/* Sin envoltorio: en la página real los filtros, el recuento y la tabla
          cuelgan directamente de la columna de arriba, con su `gap-6`. */}
      {/* Buscador + equipo, rol, vencimientos, documentación, etiqueta. */}
      <FiltersBarSkeleton selects={5} trailing={1} />
      {/* La línea del recuento de resultados. */}
      <Skeleton className="h-5 w-28" aria-hidden />
      <TableSkeleton
        leading="checkbox"
        columns={[
          "w-40",
          { width: "w-20", priority: "tertiary" },
          { width: "w-24", priority: "secondary" },
          /* Avisos: sin `priority`, es la única columna de apoyo que no se
             esconde al estrechar. */
          "w-12",
          { width: "w-44", priority: "tertiary" },
          { width: "w-16", priority: "secondary" },
          "w-16",
        ]}
        rows={10}
        lines={1}
      />
    </div>
  );
}
