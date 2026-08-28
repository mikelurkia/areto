import {
  CardSkeleton,
  DetailHeaderSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <DetailHeaderSkeleton back actions={0} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={3} />
    </div>
  );
}
