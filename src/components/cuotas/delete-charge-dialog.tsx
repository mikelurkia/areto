"use client";

import { deleteCharge } from "@/app/[locale]/(app)/cuotas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteChargeDialog({ id, subject }: { id: string; subject: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Cuotas"
      entityKey="Charge"
      paramKey="borrar-cargo"
      values={{ subject }}
      deleteAction={deleteCharge}
    />
  );
}
