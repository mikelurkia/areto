import {
  PageHeaderSkeleton,
  SectionNavSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      {/* Usuarios / roles / auditoría: la sub-navegación de la sección. */}
      <SectionNavSkeleton widths={["w-16", "w-12", "w-20"]} />
      <TableSkeleton
        columns={[
          "w-40",
          { width: "w-40", priority: "secondary" },
          "w-24",
          { width: "w-48", priority: "tertiary" },
        ]}
        rows={6}
      />
    </div>
  );
}
