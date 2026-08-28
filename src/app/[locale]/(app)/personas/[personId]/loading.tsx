import {
  FieldGridSkeleton,
  ProfileHeaderSkeleton,
  TabsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <ProfileHeaderSkeleton back actions={4} />
      {/* General, Familia, Equipos, Titulaciones, Documentos, Bitácora. */}
      <TabsSkeleton widths={["w-14", "w-14", "w-16", "w-20", "w-20", "w-16"]} />
      <FieldGridSkeleton sections={3} columns={2} rows={2} />
    </div>
  );
}
