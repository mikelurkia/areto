"use client";

import { useActionState } from "react";
import { BanIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { revokePersonMandate } from "@/app/[locale]/(app)/personas/actions";
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

export function RevokeMandateDialog({ payerPersonId }: { payerPersonId: string }) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(`revocar-domiciliacion:${payerPersonId}`);
  const [state, action] = useActionState(revokePersonMandate, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <BanIcon data-icon="inline-start" />
        {t("revokeMandateAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("revokeMandateTitle")}</DialogTitle>
          <DialogDescription>{t("revokeMandateDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="payerPersonId" value={payerPersonId} />
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("revokeMandateAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
