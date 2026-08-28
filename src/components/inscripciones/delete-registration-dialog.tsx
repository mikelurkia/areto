"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { deleteRegistration } from "@/app/[locale]/(app)/inscripciones/actions";
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
 * Confirmación de borrado definitivo de una solicitud rechazada. `redirectTo`
 * solo lo pasa el detalle: al desaparecer la fila su página daría 404, así que
 * la acción termina llevando al listado. Desde el listado se omite y basta con
 * cerrar el diálogo.
 */
export function DeleteRegistrationDialog({
  registrationId,
  fullName,
  redirectTo,
}: {
  registrationId: string;
  fullName: string;
  redirectTo?: string;
}) {
  const t = useTranslations("Inscripciones");
  const [open, setOpen] = useDialogParam(`borrar-inscripcion:${registrationId}`);
  const [state, action] = useActionState(deleteRegistration, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">{t("deleteRegistrationSr", { name: fullName })}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteRegistrationTitle", { name: fullName })}</DialogTitle>
          <DialogDescription>{t("deleteRegistrationDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={registrationId} />
          {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">
              {t("deleteRegistrationButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
