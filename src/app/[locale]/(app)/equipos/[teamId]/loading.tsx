import {
  DetailHeaderSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <DetailHeaderSkeleton back actions={1} />
      {/* Plantilla, Documentos, Bitácora. */}
      <TabsSkeleton widths={["w-20", "w-24", "w-20"]} />

      {/* Fila de capitanía y alta de persona. */}
      <div className="flex flex-wrap items-center justify-between gap-2" aria-hidden>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Contadores de plantilla y avisos de salud. */}
      <div className="flex flex-wrap items-center gap-3" aria-hidden>
        {["w-20", "w-16", "w-24", "w-20"].map((width, i) => (
          <Skeleton key={i} className={`h-4 ${width}`} />
        ))}
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      </div>

      <TableSkeleton
        leading="avatar"
        columns={[
          "w-40",
          { width: "w-20", priority: "secondary" },
          "w-10",
          { width: "w-24", priority: "tertiary" },
          "w-16",
        ]}
        rows={12}
      />
    </div>
  );
}
