"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { updatePersonIdScan } from "@/app/[locale]/(app)/personas/actions";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

export function PersonIdScanDialog({
  personId,
  side,
  fileUrl,
}: {
  personId: string;
  side: "front" | "back";
  fileUrl: string | null;
}) {
  const t = useTranslations("Personas");
  const label = t(side === "front" ? "idFrontLabel" : "idBackLabel");
  const [open, setOpen] = useDialogParam(`persona-dni-${side}:${personId}`);
  const [state, formAction] = useActionState(updatePersonIdScan, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const frozenFileUrl = useFrozenWhileOpen(open, fileUrl);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">{t("changeIdScanSr", { label })}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={personId} />
          <input type="hidden" name="side" value={side} />
          <Field>
            <FieldLabel htmlFor={`person-id-scan-${side}`}>{label}</FieldLabel>
            {frozenFileUrl ? (
              <a
                href={frozenFileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <PaperclipIcon className="size-3.5" />
                {t("documentViewFile")}
              </a>
            ) : null}
            <Input
              id={`person-id-scan-${side}`}
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
            {frozenFileUrl ? (
              <Field orientation="horizontal" className="mt-1">
                <Checkbox id={`person-id-scan-remove-${side}`} name="removeFile" />
                <Label htmlFor={`person-id-scan-remove-${side}`} className="font-normal">
                  {t("qualificationRemoveFileLabel")}
                </Label>
              </Field>
            ) : null}
          </Field>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("saveChanges")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
