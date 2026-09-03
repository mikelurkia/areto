import { PageHeaderSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Un par etiqueta+campo, la unidad que se repite en el formulario de importar. */
function FieldSkeleton({ labelWidth = "w-20" }: { labelWidth?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={`h-3 ${labelWidth}`} />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton back titleWidth="w-32" />
      <Card aria-hidden>
        <CardContent className="flex flex-col gap-4">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
