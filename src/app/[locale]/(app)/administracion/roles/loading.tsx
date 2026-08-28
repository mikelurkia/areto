import {
  PageHeaderSkeleton,
  SectionNavSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton actions={1} />
      <SectionNavSkeleton widths={["w-16", "w-12"]} />
      {/* La pantalla se mira en dos pestañas: la tabla de roles y la matriz. */}
      <TabsSkeleton widths={["w-12", "w-20"]} />
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
