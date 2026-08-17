import {
  BackLinkSkeleton,
  CardSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLinkSkeleton />
      <PageHeaderSkeleton titleWidth="w-56" />
      <div className="flex flex-col gap-3">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
      </div>
    </div>
  );
}
