import { PageHeaderSkeleton, SectionNavSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <SectionNavSkeleton widths={["w-20", "w-28", "w-24", "w-20", "w-24", "w-20"]} />
      <TableSkeleton
        columns={[
          "w-40",
          { width: "w-24", priority: "secondary" },
          { width: "w-32", priority: "tertiary" },
          { width: "w-32", priority: "secondary" },
          { width: "w-32", priority: "tertiary" },
          "w-20",
        ]}
        rows={6}
      />
    </div>
  );
}
