import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={2} />
      <div className="flex flex-col gap-4">
        {/* Buscador + equipo, rol, vencimientos, documentación, etiqueta. */}
        <FiltersBarSkeleton selects={5} trailing={1} />
        <TableSkeleton
          leading="checkbox"
          columns={["w-40", "w-16", "w-44", "w-20", "w-16"]}
          rows={10}
          lines={2}
        />
      </div>
    </div>
  );
}
