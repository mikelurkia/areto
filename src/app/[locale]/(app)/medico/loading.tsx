import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <TableSkeleton columns={["w-40", "w-24", "w-28", "w-32", "w-20"]} />
    </div>
  );
}
