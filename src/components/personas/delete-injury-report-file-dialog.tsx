"use client";

import { deleteInjuryReportFile } from "@/app/[locale]/(app)/personas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteInjuryReportFileDialog({ id }: { id: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Personas"
      entityKey="InjuryReportFile"
      paramKey="borrar-parte-fichero"
      values={{}}
      deleteAction={deleteInjuryReportFile}
    />
  );
}
