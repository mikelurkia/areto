import {
  BackLinkSkeleton,
  DetailHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLinkSkeleton />
        <DetailHeaderSkeleton actions={0} iconActions={2} />
      </div>

      {/* Etiqueta "EQUIPOS DE LA TEMPORADA" y acciones de alta. */}
      <div className="flex flex-wrap items-center justify-between gap-4" aria-hidden>
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>

      <TableSkeleton columns={["w-24", "w-36", "w-24", "w-12"]} rows={5} />
    </div>
  );
}
