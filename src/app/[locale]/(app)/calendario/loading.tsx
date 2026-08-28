import { FiltersBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      {/* Equipo, local/visitante, rango de fechas. */}
      <FiltersBarSkeleton selects={2} />
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
