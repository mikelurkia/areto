import {
  CardSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      {/* Patrocinio (3 importes) y vencimientos próximos. */}
      <CardSkeleton lines={2} />
      <CardSkeleton lines={8} />
    </div>
  );
}
