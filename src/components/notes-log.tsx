"use client";

import { useActionState, useRef } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { NoteActionState } from "@/lib/entity-notes";
import { SubmitButton } from "@/components/submit-button";
import { SubmitIconButton } from "@/components/submit-icon-button";
import { Textarea } from "@/components/ui/textarea";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";

type NoteEntry = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

type NoteAction = (
  prev: NoteActionState,
  formData: FormData,
) => Promise<NoteActionState> | NoteActionState;

function DeleteNoteButton({
  id,
  deleteAction,
  namespace,
}: {
  id: string;
  deleteAction: NoteAction;
  namespace: "Personas" | "Equipos" | "Patrocinadores";
}) {
  const t = useTranslations(namespace);
  const [state, action] = useActionState(deleteAction, {});
  useActionToast(state);

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <SubmitIconButton label={t("deleteNoteSr")} className="text-destructive">
        <Trash2Icon />
      </SubmitIconButton>
    </form>
  );
}

/**
 * Bitácora de notas genérica, compartida por persona/equipo/patrocinador.
 * `formKey` es el nombre del campo oculto con el id del padre (debe coincidir
 * con el `formKey` pasado a `makeNoteActions` en el `actions.ts` del padre).
 */
export function NotesLog({
  parentId,
  formKey,
  notes,
  addAction,
  deleteAction,
  namespace,
}: {
  parentId: string;
  formKey: string;
  notes: NoteEntry[];
  addAction: NoteAction;
  deleteAction: NoteAction;
  namespace: "Personas" | "Equipos" | "Patrocinadores";
}) {
  const t = useTranslations(namespace);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(addAction, {});
  useActionToast(state);
  // Vaciar el campo solo cuando llega una nota nueva, no al volver a la pantalla.
  useActionResult(state, (result) => {
    if (result.message) formRef.current?.reset();
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-2 print:hidden"
      >
        <input type="hidden" name={formKey} value={parentId} />
        <Textarea
          name="body"
          placeholder={t("noteBodyPlaceholder")}
          required
        />
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <SubmitButton size="sm" className="self-end">
          {t("addNoteAction")}
        </SubmitButton>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noNotesDescription")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-2 rounded-lg border p-3">
              <div className="flex-1">
                <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.authorName ? `${note.authorName} · ` : ""}
                  {note.createdAt}
                </p>
              </div>
              <DeleteNoteButton
                id={note.id}
                deleteAction={deleteAction}
                namespace={namespace}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
