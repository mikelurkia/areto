import {
  PageHeaderSkeleton,
  SectionHeadingSkeleton,
  SectionNavSkeleton,
  StatCardsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <SectionNavSkeleton widths={["w-20", "w-28", "w-28", "w-24", "w-20", "w-24", "w-20"]} />
      <div className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <StatCardsSkeleton count={4} />
      </div>
    </div>
  );
}
