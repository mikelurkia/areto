import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <TableSkeleton columns={["w-32", "w-56", "w-12", "w-20", "w-24"]} rows={4} />
    </div>
  );
}
