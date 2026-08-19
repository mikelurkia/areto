"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addInjuryReport,
  updateInjuryReport,
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

type InjuryReport = {
  id: string;
  occurredOn: string;
  description: string;
  notes: string | null;
};

type InjuryReportDialogProps =
  | { mode: "create"; personId: string }
  | { mode: "edit"; report: InjuryReport; fileUrl: string | null };

export function InjuryReportDialog(props: InjuryReportDialogProps) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `parte-nuevo:${props.personId}`
      : `parte:${props.report.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? addInjuryReport : updateInjuryReport,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const report = useFrozenWhileOpen(open, props.mode === "edit" ? props.report : null);
  const fileUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.fileUrl : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("addInjuryReportAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editInjuryReportSr", { date: report!.occurredOn })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newInjuryReportTitle") : t("editInjuryReportTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="personId" value={props.personId} />
          ) : (
            <input type="hidden" name="id" value={report!.id} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="injury-report-occurred-on">
                {t("injuryReportOccurredOnLabel")}
              </FieldLabel>
              <Input
                id="injury-report-occurred-on"
                name="occurredOn"
                type="date"
                defaultValue={report?.occurredOn ?? ""}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="injury-report-description">
                {t("injuryReportDescriptionLabel")}
              </FieldLabel>
              <Textarea
                id="injury-report-description"
                name="description"
                defaultValue={report?.description ?? ""}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="injury-report-file">
                {t("injuryReportFileLabel")}
              </FieldLabel>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {t("injuryReportViewFile")}
                </a>
              ) : null}
              <Input
                id="injury-report-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
              {fileUrl ? (
                <Field orientation="horizontal" className="mt-1">
                  <Checkbox id="injury-report-remove-file" name="removeFile" />
                  <Label htmlFor="injury-report-remove-file" className="font-normal">
                    {t("qualificationRemoveFileLabel")}
                  </Label>
                </Field>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="injury-report-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="injury-report-notes"
                name="notes"
                defaultValue={report?.notes ?? ""}
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
              {props.mode === "create" ? t("addInjuryReportAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
