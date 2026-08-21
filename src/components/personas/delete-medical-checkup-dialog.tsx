"use client";

import { deleteMedicalCheckup } from "@/app/[locale]/(app)/personas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteMedicalCheckupDialog({
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
      entityKey="MedicalCheckup"
      paramKey="borrar-reconocimiento"
      values={{ date }}
      deleteAction={deleteMedicalCheckup}
    />
  );
}
