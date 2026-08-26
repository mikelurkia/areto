import { AlertTilesSkeleton, CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {/* Rejilla de alertas, tarjeta de revisión y cuadro de la próxima jornada. */}
      <AlertTilesSkeleton />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={6} />
    </div>
  );
}
