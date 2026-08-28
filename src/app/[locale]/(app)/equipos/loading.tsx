import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Selector de temporada y "nuevo equipo". */}
      <PageHeaderSkeleton actions={2} />
      <div className="flex flex-col gap-4">
        {/* El buscador y el "exportar CSV" los pinta el navegador de equipos. */}
        <FiltersBarSkeleton trailing={1} />
        <TableSkeleton
          columns={[
            "w-32",
            { width: "w-24", priority: "secondary" },
            { width: "w-16", priority: "tertiary" },
            { width: "w-20", priority: "secondary" },
            { width: "w-16", priority: "tertiary" },
            "w-12",
          ]}
          rows={5}
        />
      </div>
    </div>
  );
}
