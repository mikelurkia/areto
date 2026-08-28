import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:max-w-2xl">
        {/* Club, inscripción web, plantilla de parte de lesión, delegaciones federativas. */}
        <CardSkeleton lines={6} />
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
