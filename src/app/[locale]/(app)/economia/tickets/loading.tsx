import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  SectionNavSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={2} />
      <SectionNavSkeleton widths={["w-20", "w-28", "w-28", "w-24", "w-20", "w-24", "w-20"]} />
      <FiltersBarSkeleton selects={2} />
      <TableSkeleton
        columns={[
          "w-40",
          "w-32",
          { width: "w-24", priority: "secondary" },
          "w-20",
          { width: "w-28", priority: "secondary" },
          { width: "w-16", priority: "tertiary" },
          "w-16",
        ]}
        rows={8}
      />
    </div>
  );
}
