import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3">
        {/* Socios, Solicitudes */}
        <TabsSkeleton widths={["w-16", "w-24"]} />
        <FiltersBarSkeleton selects={1} trailing={1} />
        <TableSkeleton
          columns={[
            "w-40",
            { width: "w-24", priority: "secondary" },
            { width: "w-40", priority: "tertiary" },
            { width: "w-24", priority: "secondary" },
            "w-16",
          ]}
          rows={8}
        />
      </div>
    </div>
  );
}
