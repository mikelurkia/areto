import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* La acción de la derecha es el selector de temporada. */}
      <PageHeaderSkeleton actions={1} />
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
      <Skeleton className="h-8 w-28" aria-hidden />
    </div>
  );
}
