import { CardSkeleton, PageHeaderSkeleton, TabsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-4 lg:max-w-2xl">
        {/* Datos del club, Firmantes, Inscripciones, Médico, Federaciones. */}
        <TabsSkeleton widths={["w-24", "w-20", "w-24", "w-16", "w-24"]} />
        {/* Pestaña por defecto: Datos del club. */}
        <CardSkeleton lines={6} fields />
      </div>
    </div>
  );
}
