"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

type EntityKey = "Document" | "Qualification" | "MedicalCheckup" | "InjuryReport";

/** Forma común de las Server Actions de borrado (documentos, titulaciones, médico, lesiones). */
type DeleteActionState = { error?: string; message?: string };

/**
 * Diálogo de confirmación de borrado genérico, compartido por documentos,
 * titulaciones, reconocimientos médicos y partes de lesión. `entityKey`
 * construye las claves de traducción (`delete${entityKey}Sr/Title/Description/
 * Button`); `values` es el objeto de interpolación que espera cada mensaje
 * (varía por entidad: `{label}`, `{title}`, `{date}`), así no hay que tocar
 * `messages/*.json` para unificar este componente.
 */
export function DeleteEntityDialog({
  id,
  namespace,
  entityKey,
  paramKey,
  values,
  deleteAction,
}: {
  id: string;
  namespace: "Personas" | "Equipos" | "Patrocinadores";
  entityKey: EntityKey;
  paramKey: string;
  values: Record<string, string>;
  deleteAction: (
    prev: DeleteActionState,
    formData: FormData,
  ) => Promise<DeleteActionState> | DeleteActionState;
}) {
  const t = useTranslations(namespace);
  const [open, setOpen] = useDialogParam(`${paramKey}:${id}`);
  const [state, action] = useActionState(deleteAction, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">
          {t(`delete${entityKey}Sr` as "deleteDocumentSr", values)}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`delete${entityKey}Title` as "deleteDocumentTitle", values)}</DialogTitle>
          <DialogDescription>
            {t(`delete${entityKey}Description` as "deleteDocumentDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          {state.error ? (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">
              {t(`delete${entityKey}Button` as "deleteDocumentButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
