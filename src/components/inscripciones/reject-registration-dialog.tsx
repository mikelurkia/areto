"use client";

import { useActionState } from "react";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { rejectRegistration } from "@/app/[locale]/(app)/inscripciones/actions";
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
import { FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

/** Rechazo desde la tabla, sin pasar por la ficha: mismo motivo obligatorio
 * que exige `rejectRegistration` en el formulario de revisión completo. */
export function RejectRegistrationDialog({
  registrationId,
  fullName,
}: {
  registrationId: string;
  fullName: string;
}) {
  const t = useTranslations("Inscripciones");
  const [open, setOpen] = useDialogParam(`rechazar-inscripcion:${registrationId}`);
  const [state, action] = useActionState(rejectRegistration, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>
        <XIcon data-icon="inline-start" />
        {t("quickRejectAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("quickRejectTitle", { name: fullName })}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={registrationId} />
          <FieldLabel htmlFor="rejectionReason">{t("rejectionReasonLabel")}</FieldLabel>
          <Textarea
            id="rejectionReason"
            name="rejectionReason"
            placeholder={t("rejectionReasonPlaceholder")}
          />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("quickRejectButton")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
