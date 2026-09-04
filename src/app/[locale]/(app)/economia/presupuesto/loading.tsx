import {
  PageHeaderSkeleton,
  SectionHeadingSkeleton,
  SectionNavSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={2} />
      <SectionNavSkeleton
        widths={["w-20", "w-28", "w-28", "w-24", "w-20", "w-24", "w-20"]}
      />
      <div className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <TableSkeleton
          columns={[
            "w-40",
            "w-24",
            { width: "w-24", priority: "secondary" },
            { width: "w-24", priority: "secondary" },
            "w-24",
          ]}
          rows={4}
        />
      </div>
      <div className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <TableSkeleton
          columns={[
            "w-40",
            "w-24",
            { width: "w-24", priority: "secondary" },
            { width: "w-24", priority: "secondary" },
            "w-24",
          ]}
          rows={6}
        />
      </div>
    </div>
  );
}
