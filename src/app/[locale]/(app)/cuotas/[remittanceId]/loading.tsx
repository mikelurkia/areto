import {
  DetailHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <DetailHeaderSkeleton back actions={2} />
      <StatCardsSkeleton count={3} />
      <TableSkeleton
        columns={[
          "w-32",
          { width: "w-32", priority: "secondary" },
          { width: "w-24", priority: "tertiary" },
          "w-16",
          "w-20",
        ]}
        rows={6}
      />
    </div>
  );
}
