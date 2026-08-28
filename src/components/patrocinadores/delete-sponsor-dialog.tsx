"use client";

import { deleteSponsor } from "@/app/[locale]/(app)/patrocinadores/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteSponsorDialog({ id, name }: { id: string; name: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Patrocinadores"
      entityKey="Sponsor"
      paramKey="borrar-patrocinador"
      values={{ name }}
      deleteAction={deleteSponsor}
    />
  );
}
