"use client";

import { removeMembership } from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteMembershipDialog({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Equipos"
      entityKey="Member"
      verb="remove"
      paramKey="borrar-membresia"
      values={{ name }}
      deleteAction={removeMembership}
    />
  );
}
