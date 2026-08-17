import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <TableSkeleton columns={["w-24", "w-44", "w-16", "w-12"]} rows={4} />
    </div>
  );
}
