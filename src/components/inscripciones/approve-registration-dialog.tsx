"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { approveRegistration } from "@/app/[locale]/(app)/inscripciones/actions";
import { FormError } from "@/components/form-error";
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

/**
 * Aprobación en un clic desde la tabla, sin pasar por la ficha: solo se
 * ofrece cuando la página ya ha comprobado que no hay ningún candidato a
 * duplicado (ver `canQuickApprove` en `socios/page.tsx`), así que siempre da
 * de alta una persona nueva, sin equipo (`matchedPersonId=new`, sin `teamId`).
 */
export function ApproveRegistrationDialog({
  registrationId,
  fullName,
}: {
  registrationId: string;
  fullName: string;
}) {
  const t = useTranslations("Inscripciones");
  const [open, setOpen] = useDialogParam(`aprobar-inscripcion:${registrationId}`);
  const [state, action] = useActionState(approveRegistration, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CheckIcon data-icon="inline-start" />
        {t("quickApproveAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("quickApproveTitle", { name: fullName })}</DialogTitle>
          <DialogDescription>{t("quickApproveDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={registrationId} />
          <input type="hidden" name="matchedPersonId" value="new" />
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("quickApproveButton")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
