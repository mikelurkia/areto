"use client";

import { useActionState, useState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addQualification,
  updateQualification,
} from "@/app/[locale]/(app)/personas/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

type Qualification = {
  id: string;
  title: string;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
};

type QualificationDialogProps =
  | { mode: "create"; personId: string }
  | { mode: "edit"; qualification: Qualification; fileUrl: string | null };

export function QualificationDialog(props: QualificationDialogProps) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    props.mode === "create" ? addQualification : updateQualification,
    {},
  );
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  const qualification = useFrozenWhileOpen(
    open,
    props.mode === "edit" ? props.qualification : null,
  );
  const fileUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.fileUrl : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("addQualificationAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editQualificationSr", { title: qualification!.title })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create"
              ? t("newQualificationTitle")
              : t("editQualificationTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="personId" value={props.personId} />
          ) : (
            <input type="hidden" name="id" value={qualification!.id} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="qualification-title">
                {t("qualificationTitleLabel")}
              </FieldLabel>
              <Input
                id="qualification-title"
                name="title"
                defaultValue={qualification?.title ?? ""}
                placeholder={t("qualificationTitlePlaceholder")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="qualification-issuer">
                {t("qualificationIssuerLabel")}
              </FieldLabel>
              <Input
                id="qualification-issuer"
                name="issuer"
                defaultValue={qualification?.issuer ?? ""}
                placeholder={t("qualificationIssuerPlaceholder")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="qualification-issued-on">
                  {t("qualificationIssuedOnLabel")}
                </FieldLabel>
                <Input
                  id="qualification-issued-on"
                  name="issuedOn"
                  type="date"
                  defaultValue={qualification?.issuedOn ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="qualification-expires-on">
                  {t("qualificationExpiresOnLabel")}
                </FieldLabel>
                <Input
                  id="qualification-expires-on"
                  name="expiresOn"
                  type="date"
                  defaultValue={qualification?.expiresOn ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="qualification-file">
                {t("qualificationFileLabel")}
              </FieldLabel>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {t("qualificationViewFile")}
                </a>
              ) : null}
              <Input
                id="qualification-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
              {fileUrl ? (
                <Field orientation="horizontal" className="mt-1">
                  <Checkbox id="qualification-remove-file" name="removeFile" />
                  <Label htmlFor="qualification-remove-file" className="font-normal">
                    {t("qualificationRemoveFileLabel")}
                  </Label>
                </Field>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="qualification-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="qualification-notes"
                name="notes"
                defaultValue={qualification?.notes ?? ""}
                placeholder={t("qualificationNotesPlaceholder")}
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
              {props.mode === "create" ? t("addQualificationAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
