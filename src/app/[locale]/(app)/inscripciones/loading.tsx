import { FiltersBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-4">
        <FiltersBarSkeleton selects={1} trailing={1} />
        <TableSkeleton
          columns={[
            "w-36",
            { width: "w-24", priority: "tertiary" },
            { width: "w-32", priority: "tertiary" },
            { width: "w-24", priority: "tertiary" },
            { width: "w-16", priority: "secondary" },
            { width: "w-20", priority: "secondary" },
            { width: "w-20", priority: "secondary" },
            "w-16",
          ]}
          rows={8}
        />
      </div>
    </div>
  );
}
