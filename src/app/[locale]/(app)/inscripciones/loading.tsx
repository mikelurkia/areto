import { FiltersBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-4">
        <FiltersBarSkeleton selects={1} trailing={1} />
        <TableSkeleton
          columns={["w-36", "w-24", "w-32", "w-16", "w-16", "w-20", "w-20"]}
          rows={8}
        />
      </div>
    </div>
  );
}
