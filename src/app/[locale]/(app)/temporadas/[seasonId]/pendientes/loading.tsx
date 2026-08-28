import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton back />
      <TableSkeleton
        leading="checkbox"
        columns={[
          "w-32",
          { width: "w-24", priority: "secondary" },
          { width: "w-20", priority: "secondary" },
          { width: "w-40", priority: "tertiary" },
          "w-16",
        ]}
        rows={6}
        // El último hueco es el del recordatorio (WhatsApp y correo), que no va
        // alineado a la derecha como la columna de acciones de los listados.
        actions={false}
      />
    </div>
  );
}
