"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addDataConsent,
  updateDataConsent,
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

type DataConsent = {
  id: string;
  seasonName: string;
  signedOn: string | null;
  notes: string | null;
};

type DataConsentDialogProps =
  | { mode: "create"; personId: string; currentSeasonName: string }
  | { mode: "edit"; consent: DataConsent; fileUrl: string | null };

export function DataConsentDialog(props: DataConsentDialogProps) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `consentimiento-datos-nuevo:${props.personId}`
      : `consentimiento-datos:${props.consent.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? addDataConsent : updateDataConsent,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const consent = useFrozenWhileOpen(open, props.mode === "edit" ? props.consent : null);
  const fileUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.fileUrl : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("addDataConsentAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editDataConsentSr", { seasonName: consent!.seasonName })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create"
              ? t("newDataConsentTitle")
              : t("editDataConsentTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="personId" value={props.personId} />
          ) : (
            <input type="hidden" name="id" value={consent!.id} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel>{t("dataConsentSeasonLabel")}</FieldLabel>
              <p className="text-sm">
                {props.mode === "create" ? props.currentSeasonName : consent!.seasonName}
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="data-consent-signed-on">
                {t("dataConsentSignedOnLabel")}
              </FieldLabel>
              <Input
                id="data-consent-signed-on"
                name="signedOn"
                type="date"
                defaultValue={consent?.signedOn ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="data-consent-file">
                {t("dataConsentFileLabel")}
              </FieldLabel>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {t("dataConsentViewFile")}
                </a>
              ) : null}
              <Input
                id="data-consent-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
              {fileUrl ? (
                <Field orientation="horizontal" className="mt-1">
                  <Checkbox id="data-consent-remove-file" name="removeFile" />
                  <Label htmlFor="data-consent-remove-file" className="font-normal">
                    {t("qualificationRemoveFileLabel")}
                  </Label>
                </Field>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="data-consent-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="data-consent-notes"
                name="notes"
                defaultValue={consent?.notes ?? ""}
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
              {props.mode === "create" ? t("addDataConsentAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
