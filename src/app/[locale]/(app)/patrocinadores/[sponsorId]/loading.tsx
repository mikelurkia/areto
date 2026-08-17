import {
  BackLinkSkeleton,
  DetailHeaderSkeleton,
  FieldGridSkeleton,
  TabsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLinkSkeleton />
      {/* El logo ocupa un cuadrado a la izquierda del nombre. */}
      <DetailHeaderSkeleton media actions={1} iconActions={2} />
      {/* General, Patrocinios, Contactos, Documentos, Seguimiento. */}
      <TabsSkeleton widths={["w-14", "w-20", "w-20", "w-20", "w-24"]} />
      <FieldGridSkeleton sections={2} columns={2} rows={2} />
    </div>
  );
}
