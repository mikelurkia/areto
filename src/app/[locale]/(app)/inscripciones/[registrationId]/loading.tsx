import {
  BackLinkSkeleton,
  CardSkeleton,
  DetailHeaderSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLinkSkeleton />
      <DetailHeaderSkeleton actions={0} />
      {/* Foto, DNI (delante) y DNI (detrás) subidos en la inscripción. */}
      <CardSkeleton lines={1} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={3} />
    </div>
  );
}
