import {
  PageHeaderSkeleton,
  SectionNavSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      {/* Usuarios / roles: la sub-navegación de la sección. */}
      <SectionNavSkeleton widths={["w-16", "w-12"]} />
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
