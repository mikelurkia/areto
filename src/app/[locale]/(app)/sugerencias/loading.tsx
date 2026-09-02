import {
  CardSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function SugerenciasLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="max-w-xl">
        <CardSkeleton fields lines={2} />
      </div>
      <TableSkeleton
        columns={["w-48", "w-32", "w-28", "w-24"]}
        actions={false}
      />
    </div>
  );
}
