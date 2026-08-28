"use client";

import { deleteTeam } from "@/app/[locale]/(app)/equipos/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

export function DeleteTeamDialog({
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
      entityKey="Team"
      paramKey="borrar-equipo"
      values={{ name }}
      deleteAction={deleteTeam}
    />
  );
}
