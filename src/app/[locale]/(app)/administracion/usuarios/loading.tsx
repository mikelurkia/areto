import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <TableSkeleton
        columns={[
          "w-48",
          { width: "w-28", priority: "secondary" },
          { width: "w-40", priority: "tertiary" },
          { width: "w-24", priority: "secondary" },
          { width: "w-24", priority: "tertiary" },
          "w-12",
        ]}
        rows={5}
      />
    </div>
  );
}
