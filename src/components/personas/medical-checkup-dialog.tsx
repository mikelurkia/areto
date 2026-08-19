"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addMedicalCheckup,
  updateMedicalCheckup,
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
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

type MedicalCheckup = {
  id: string;
  occurredOn: string;
  expiresOn: string | null;
  issuer: string | null;
  notes: string | null;
};

type MedicalCheckupDialogProps =
  | { mode: "create"; personId: string }
  | { mode: "edit"; checkup: MedicalCheckup; fileUrl: string | null };

export function MedicalCheckupDialog(props: MedicalCheckupDialogProps) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `reconocimiento-nuevo:${props.personId}`
      : `reconocimiento:${props.checkup.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? addMedicalCheckup : updateMedicalCheckup,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const checkup = useFrozenWhileOpen(open, props.mode === "edit" ? props.checkup : null);
  const fileUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.fileUrl : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("addMedicalCheckupAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editMedicalCheckupSr", { date: checkup!.occurredOn })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create"
              ? t("newMedicalCheckupTitle")
              : t("editMedicalCheckupTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="personId" value={props.personId} />
          ) : (
            <input type="hidden" name="id" value={checkup!.id} />
          )}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="medical-checkup-occurred-on">
                  {t("medicalCheckupOccurredOnLabel")}
                </FieldLabel>
                <Input
                  id="medical-checkup-occurred-on"
                  name="occurredOn"
                  type="date"
                  defaultValue={checkup?.occurredOn ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="medical-checkup-expires-on">
                  {t("medicalCheckupExpiresOnLabel")}
                </FieldLabel>
                <Input
                  id="medical-checkup-expires-on"
                  name="expiresOn"
                  type="date"
                  defaultValue={checkup?.expiresOn ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="medical-checkup-issuer">
                {t("medicalCheckupIssuerLabel")}
              </FieldLabel>
              <Input
                id="medical-checkup-issuer"
                name="issuer"
                defaultValue={checkup?.issuer ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="medical-checkup-file">
                {t("medicalCheckupFileLabel")}
              </FieldLabel>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {t("medicalCheckupViewFile")}
                </a>
              ) : null}
              <Input
                id="medical-checkup-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
              {fileUrl ? (
                <Field orientation="horizontal" className="mt-1">
                  <Checkbox id="medical-checkup-remove-file" name="removeFile" />
                  <Label htmlFor="medical-checkup-remove-file" className="font-normal">
                    {t("qualificationRemoveFileLabel")}
                  </Label>
                </Field>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="medical-checkup-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="medical-checkup-notes"
                name="notes"
                defaultValue={checkup?.notes ?? ""}
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
              {props.mode === "create" ? t("addMedicalCheckupAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
