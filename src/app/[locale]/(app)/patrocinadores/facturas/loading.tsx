import {
  BackLinkSkeleton,
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLinkSkeleton />
      <PageHeaderSkeleton actions={1} />
      <FiltersBarSkeleton selects={1} trailing={1} />
      <TableSkeleton columns={["w-20", "w-24", "w-40", "w-48", "w-16"]} rows={8} />
    </div>
  );
}
