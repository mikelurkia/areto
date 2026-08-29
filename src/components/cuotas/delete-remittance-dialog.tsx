"use client";

import { deleteRemittance } from "@/app/[locale]/(app)/cuotas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteRemittanceDialog({ id, messageId }: { id: string; messageId: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Cuotas"
      entityKey="Remittance"
      paramKey="borrar-remesa"
      values={{ messageId }}
      deleteAction={deleteRemittance}
    />
  );
}
