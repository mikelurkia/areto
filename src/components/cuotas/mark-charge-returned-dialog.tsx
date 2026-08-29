"use client";

import { useActionState } from "react";
import { UndoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateChargeStatus } from "@/app/[locale]/(app)/cuotas/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

export function MarkChargeReturnedDialog({ id }: { id: string }) {
  const t = useTranslations("Cuotas");
  const [open, setOpen] = useDialogParam(`marcar-devuelto:${id}`);
  const [state, action] = useActionState(updateChargeStatus, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <UndoIcon />
        <span className="sr-only">{t("markReturnedSr")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("markReturnedTitle")}</DialogTitle>
          <DialogDescription>{t("markReturnedDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="returned" />
          <Field>
            <FieldLabel htmlFor={`return-reason-${id}`}>{t("returnReasonLabel")}</FieldLabel>
            <Textarea id={`return-reason-${id}`} name="returnReason" rows={3} />
          </Field>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("markReturnedAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
