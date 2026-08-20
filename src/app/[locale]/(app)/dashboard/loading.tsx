import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {/* Por hacer, incoherencias de datos, vencimientos próximos y patrocinio (3 importes). */}
      <CardSkeleton lines={3} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={8} />
      <CardSkeleton lines={2} />
    </div>
  );
}
