import { BackLinkSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * El carné no es una hoja A4 sino una tarjeta estrecha, así que no usa
 * `PrintableSheetSkeleton`: reserva su cabecera de color, la foto y las líneas
 * de datos con las mismas medidas que la tarjeta real.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between">
        <BackLinkSkeleton />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-sm">
        <div className="flex flex-col gap-1.5 bg-muted px-4 py-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-4 p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="size-[72px] shrink-0 rounded" />
        </div>
      </div>
    </div>
  );
}
