import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <div className="flex flex-col gap-4">
        <FiltersBarSkeleton trailing={1} />
        <TableSkeleton
          columns={["w-24", { width: "w-44", priority: "secondary" }, "w-16", "w-12"]}
          rows={4}
        />
      </div>
    </div>
  );
}
