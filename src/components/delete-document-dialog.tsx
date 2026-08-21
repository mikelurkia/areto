"use client";

import type { DocumentActionState } from "@/lib/entity-documents";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

type DocumentAction = (
  prev: DocumentActionState,
  formData: FormData,
) => Promise<DocumentActionState> | DocumentActionState;

/** Diálogo de confirmación de borrado de documento, compartido por persona/equipo/patrocinador. */
export function DeleteDocumentDialog({
  id,
  label,
  deleteAction,
  namespace,
}: {
  id: string;
  label: string;
  deleteAction: DocumentAction;
  namespace: "Personas" | "Equipos" | "Patrocinadores";
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace={namespace}
      entityKey="Document"
      paramKey="borrar-documento"
      values={{ label }}
      deleteAction={deleteAction}
    />
  );
}
