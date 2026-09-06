"use client";

import { deleteDataConsent } from "@/app/[locale]/(app)/personas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteDataConsentDialog({
  id,
  seasonName,
}: {
  id: string;
  seasonName: string;
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Personas"
      entityKey="DataConsent"
      paramKey="borrar-consentimiento-datos"
      values={{ seasonName }}
      deleteAction={deleteDataConsent}
    />
  );
}
