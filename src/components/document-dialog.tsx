"use client";

import { useActionState, useState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DocumentActionState } from "@/lib/entity-documents";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

type DocumentEntry = {
  id: string;
  label: string;
  notes: string | null;
};

type DocumentAction = (
  prev: DocumentActionState,
  formData: FormData,
) => Promise<DocumentActionState> | DocumentActionState;

type DocumentDialogProps = {
  namespace: "Personas" | "Equipos" | "Patrocinadores";
  addAction: DocumentAction;
  updateAction: DocumentAction;
  htmlIdPrefix: string;
} & (
  | { mode: "create"; parentId: string; formKey: string }
  | { mode: "edit"; document: DocumentEntry; fileUrl: string | null }
);

/** Diálogo de crear/editar documento, compartido por persona/equipo/patrocinador. */
export function DocumentDialog(props: DocumentDialogProps) {
  const t = useTranslations(props.namespace);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    props.mode === "create" ? props.addAction : props.updateAction,
    {},
  );
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  const document = useFrozenWhileOpen(
    open,
    props.mode === "edit" ? props.document : null,
  );
  const fileUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.fileUrl : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("addDocumentAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editDocumentSr", { label: document!.label })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newDocumentTitle") : t("editDocumentTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name={props.formKey} value={props.parentId} />
          ) : (
            <input type="hidden" name="id" value={document!.id} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${props.htmlIdPrefix}-label`}>
                {t("documentLabelLabel")}
              </FieldLabel>
              <Input
                id={`${props.htmlIdPrefix}-label`}
                name="label"
                defaultValue={document?.label ?? ""}
                placeholder={t("documentLabelPlaceholder")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${props.htmlIdPrefix}-file`}>
                {t("documentFileLabel")}
              </FieldLabel>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {t("documentViewFile")}
                </a>
              ) : null}
              <Input
                id={`${props.htmlIdPrefix}-file`}
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                required={props.mode === "create"}
              />
              {props.mode === "edit" ? (
                <p className="text-xs text-muted-foreground">
                  {t("documentReplaceFileHint")}
                </p>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${props.htmlIdPrefix}-notes`}>
                {t("notesLabel")}
              </FieldLabel>
              <Textarea
                id={`${props.htmlIdPrefix}-notes`}
                name="notes"
                defaultValue={document?.notes ?? ""}
                placeholder={t("documentNotesPlaceholder")}
              />
            </Field>
          </FieldGroup>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>
              {props.mode === "create" ? t("addDocumentAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
