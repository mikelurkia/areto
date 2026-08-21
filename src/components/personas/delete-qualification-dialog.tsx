"use client";

import { deleteQualification } from "@/app/[locale]/(app)/personas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteQualificationDialog({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Personas"
      entityKey="Qualification"
      paramKey="borrar-titulacion"
      values={{ title }}
      deleteAction={deleteQualification}
    />
  );
}
