import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <TableSkeleton
        columns={[
          "w-32",
          { width: "w-56", priority: "tertiary" },
          { width: "w-12", priority: "secondary" },
          { width: "w-20", priority: "secondary" },
          "w-24",
        ]}
        rows={4}
      />
    </div>
  );
}
