import { FiltersBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      {/* Equipo, local/visitante, rango de fechas. */}
      <FiltersBarSkeleton selects={2} />
      <TableSkeleton
        columns={["w-32", "w-20", "w-32", "w-28", "w-40", "w-16"]}
        rows={6}
      />
    </div>
  );
}
