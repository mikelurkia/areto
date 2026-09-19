import { MedicalPanelSkeleton } from "@/components/medico/medical-panel-skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeaderSkeleton />
      <MedicalPanelSkeleton />
    </div>
  );
}
