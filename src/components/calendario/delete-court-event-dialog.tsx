"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { deleteCourtEvent } from "@/app/[locale]/(app)/calendario/actions";
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

export function DeleteCourtEventDialog({ id }: { id: string }) {
  const t = useTranslations("Calendario");
  const [open, setOpen] = useDialogParam(`borrar-partido:${id}`);
  const [state, action] = useActionState(deleteCourtEvent, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">{t("deleteMatchSr")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteMatchTitle")}</DialogTitle>
          <DialogDescription>{t("deleteMatchDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("deleteMatchButton")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
