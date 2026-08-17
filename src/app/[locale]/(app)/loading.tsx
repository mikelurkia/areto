import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

/**
 * Fallback de red para todo el grupo `(app)`: cubre las rutas que no tienen su
 * propio `loading.tsx` (vistas de impresión, pantallas en construcción...).
 * Deliberadamente neutro, porque sirve tanto para formularios como para listas.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
    </div>
  );
}
