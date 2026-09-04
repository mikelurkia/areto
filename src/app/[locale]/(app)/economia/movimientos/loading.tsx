import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  SectionNavSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={2} />
      <SectionNavSkeleton widths={["w-20", "w-28", "w-24", "w-20", "w-24", "w-20"]} />
      <StatCardsSkeleton count={3} />
      <FiltersBarSkeleton selects={3} trailing={1} />
      <TableSkeleton
        columns={[
          "w-24",
          "w-48",
          { width: "w-28", priority: "secondary" },
          { width: "w-32", priority: "tertiary" },
          { width: "w-28", priority: "secondary" },
          "w-20",
          { width: "w-20", priority: "tertiary" },
        ]}
        rows={8}
      />
    </div>
  );
}
