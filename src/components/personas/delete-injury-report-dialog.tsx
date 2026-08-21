"use client";

import { deleteInjuryReport } from "@/app/[locale]/(app)/personas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteInjuryReportDialog({
  id,
  date,
}: {
  id: string;
  date: string;
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Personas"
      entityKey="InjuryReport"
      paramKey="borrar-parte"
      values={{ date }}
      deleteAction={deleteInjuryReport}
    />
  );
}
