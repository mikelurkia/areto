import { DetailHeaderSkeleton, FieldGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <DetailHeaderSkeleton back actions={2} />
      <FieldGridSkeleton sections={2} columns={1} rows={6} />
    </div>
  );
}
