import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Libro de facturas, muro público, importar, nuevo patrocinador. */}
      <PageHeaderSkeleton actions={4} />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-40" aria-hidden />
        <StatCardsSkeleton count={4} />
      </div>
      <div className="flex flex-col gap-4">
        <FiltersBarSkeleton selects={2} trailing={2} />
        <TableSkeleton
          columns={[
            "w-36",
            { width: "w-12", priority: "tertiary" },
            { width: "w-20", priority: "secondary" },
            { width: "w-28", priority: "tertiary" },
            { width: "w-16", priority: "secondary" },
            { width: "w-44", priority: "tertiary" },
            { width: "w-16", priority: "secondary" },
            "w-12",
          ]}
          rows={10}
        />
      </div>
    </div>
  );
}
