import {
  PageHeaderSkeleton,
  SectionHeadingSkeleton,
  SectionNavSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <SectionNavSkeleton widths={["w-20", "w-28", "w-20"]} />
      <div className="flex flex-col gap-4">
        <SectionHeadingSkeleton action />
        <TableSkeleton
          columns={[
            "w-40",
            { width: "w-20", priority: "secondary" },
            { width: "w-36", priority: "secondary" },
            "w-24",
            { width: "w-24", priority: "secondary" },
          ]}
          rows={3}
        />
      </div>
      <div className="flex flex-col gap-4">
        <SectionHeadingSkeleton action />
        <TableSkeleton
          columns={["w-40", "w-20", { width: "w-12", priority: "secondary" }]}
          rows={6}
        />
      </div>
    </div>
  );
}
