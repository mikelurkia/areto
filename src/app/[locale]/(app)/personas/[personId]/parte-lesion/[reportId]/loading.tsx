import { BackLinkSkeleton, CardSkeleton } from "@/components/skeletons";

/**
 * El parte de lesión no es un imprimible sino el formulario que lo genera:
 * cabecera con "volver", y la tarjeta de datos federativos.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLinkSkeleton />
      <div className="grid gap-4 lg:max-w-2xl">
        <CardSkeleton fields lines={4} />
      </div>
    </div>
  );
}
