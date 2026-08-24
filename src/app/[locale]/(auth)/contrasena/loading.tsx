import { Skeleton } from "@/components/ui/skeleton";

/**
 * La página resuelve la sesión en su cuerpo (`requireUser`), que es dato de
 * runtime: con Cache Components eso necesita un límite de suspensión a nivel
 * de ruta, y este fichero es quien lo pone.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8" aria-hidden>
        <Skeleton className="mx-auto h-8 w-28" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
