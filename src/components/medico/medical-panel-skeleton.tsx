import {
  FiltersBarSkeleton,
  SectionHeadingSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto del panel médico completo: resumen, filtros y las dos secciones
 * (reconocimientos y partes de lesión).
 *
 * Vive aquí y no en `skeletons.tsx` porque es la geometría de un componente
 * concreto, y lo usan dos sitios: el `loading.tsx` de la ruta y el `<Suspense>`
 * interno que el panel necesita por leer `useSearchParams`. Tenerlo una sola vez
 * evita que uno de los dos se quede corto —era el caso: el interno pintaba solo
 * una tabla y al llegar el panel la pantalla daba un salto.
 */
export function MedicalPanelSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Resumen de la sección: el total a la izquierda y los avisos a la derecha. */}
      <Card
        size="sm"
        className="flex-row flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing)"
        aria-hidden
      >
        <Skeleton className="h-4 w-28" />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </Card>

      {/* Buscador + equipo y estado; imprimir listado y exportar a la derecha. */}
      <FiltersBarSkeleton selects={2} trailing={2} />

      <div className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
        {/* Reconocimientos: nombre, equipos y estado. Sin columna de acciones. */}
        <TableSkeleton
          columns={["w-40", { width: "w-24", priority: "secondary" }, "w-28"]}
          rows={8}
          actions={false}
        />
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
        {/*
          Partes de lesión: fecha, persona, equipos y el enlace al parte, que va
          pegado al texto y no alineado a la derecha como en los listados.
        */}
        <TableSkeleton
          columns={["w-24", "w-40", { width: "w-24", priority: "secondary" }, "w-8"]}
          rows={4}
          actions={false}
        />
      </div>
    </div>
  );
}
