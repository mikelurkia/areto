import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

/**
 * Fallback de red para todo el grupo `(app)`: cubre las rutas que no tienen su
 * propio `loading.tsx`. Deliberadamente neutro, porque sirve tanto para
 * formularios como para listas.
 *
 * Con el mapa de esqueletos completo ya no debería verse en ninguna pantalla
 * conocida: es la red por si aparece una ruta nueva sin el suyo.
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
