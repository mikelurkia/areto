"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DocumentActionState } from "@/lib/entity-documents";
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
  const t = useTranslations(namespace);
  const [open, setOpen] = useDialogParam(`borrar-documento:${id}`);
  const [state, action] = useActionState(deleteAction, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">{t("deleteDocumentSr", { label })}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteDocumentTitle", { label })}</DialogTitle>
          <DialogDescription>{t("deleteDocumentDescription")}</DialogDescription>
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
              {t("deleteDocumentButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
