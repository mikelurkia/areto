"use client";

import { useActionState } from "react";
import { PaperclipIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  uploadInjuryReportCustomFile,
  type PersonState,
} from "@/app/[locale]/(app)/personas/actions";
import { DeleteInjuryReportFileDialog } from "@/components/personas/delete-injury-report-file-dialog";
import { SendInjuryReportDialog } from "@/components/personas/send-injury-report-dialog";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

const initialState: PersonState = {};

/**
 * Gestión del fichero del parte: guardar los datos de arriba (ver
 * `InjuryReportForm`) ya genera el fichero. Aquí solo quedan las acciones
 * secundarias — verlo, reemplazarlo por uno propio, o borrarlo — con menos
 * peso visual que el botón principal de guardar.
 */
export function InjuryReportFileManager({
  reportId,
  fileUrl,
  person,
  guardians,
}: {
  reportId: string;
  fileUrl: string | null;
  person: { name: string; email: string | null };
  guardians: { id: string; name: string; email: string | null }[];
}) {
  const t = useTranslations("Personas");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          <PaperclipIcon className="size-3.5" />
          {t("injuryReportViewFile")}
        </a>
      ) : null}
      {fileUrl ? (
        <SendInjuryReportDialog reportId={reportId} person={person} guardians={guardians} />
      ) : null}
      <UploadCustomInjuryReportFileLink reportId={reportId} hasFile={fileUrl !== null} />
      {fileUrl ? <DeleteInjuryReportFileDialog id={reportId} /> : null}
    </div>
  );
}

function UploadCustomInjuryReportFileLink({
  reportId,
  hasFile,
}: {
  reportId: string;
  hasFile: boolean;
}) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(`parte-subir:${reportId}`);
  const [state, action] = useActionState(uploadInjuryReportCustomFile, initialState);
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="flex items-center gap-1 text-muted-foreground hover:underline" />
        }
      >
        <UploadIcon className="size-3.5" />
        {t("injuryReportUploadCustomAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("injuryReportUploadCustomTitle")}</DialogTitle>
          <DialogDescription>
            {hasFile
              ? t("injuryReportUploadCustomReplaceDescription")
              : t("injuryReportUploadCustomDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={reportId} />
          <Field>
            <FieldLabel htmlFor="injury-report-custom-file">
              {t("injuryReportFileLabel")}
            </FieldLabel>
            <Input
              id="injury-report-custom-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              required
            />
          </Field>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("injuryReportUploadCustomAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
