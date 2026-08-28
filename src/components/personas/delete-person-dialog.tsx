"use client";

import { deletePerson } from "@/app/[locale]/(app)/personas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeletePersonDialog({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Personas"
      entityKey="Person"
      paramKey="borrar-persona"
      values={{ name }}
      deleteAction={deletePerson}
    />
  );
}
