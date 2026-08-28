import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton back />
      <TableSkeleton columns={["w-32", "w-24", "w-20", "w-40", "w-16"]} rows={6} />
    </div>
  );
}
