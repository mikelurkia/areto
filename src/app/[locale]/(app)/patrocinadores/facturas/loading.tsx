import {
  FiltersBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton back actions={1} />
      <FiltersBarSkeleton selects={1} trailing={1} />
      <TableSkeleton
        columns={[
          { width: "w-20", priority: "secondary" },
          "w-24",
          "w-40",
          { width: "w-48", priority: "tertiary" },
          "w-16",
          "w-12",
        ]}
        rows={8}
      />
    </div>
  );
}
