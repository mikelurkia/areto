import {
  PageHeaderSkeleton,
  SectionHeadingSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={3} />
      <StatCardsSkeleton count={3} />
      <div className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
        <TableSkeleton
          columns={["w-32", { width: "w-20", priority: "secondary" }, "w-12", "w-16"]}
          actions={false}
          rows={2}
        />
      </div>
      <TableSkeleton
        columns={[
          "w-32",
          { width: "w-28", priority: "secondary" },
          { width: "w-20", priority: "tertiary" },
          "w-12",
          "w-16",
          "w-24",
        ]}
        actions={false}
      />
    </div>
  );
}
