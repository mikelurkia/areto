"use client";

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { deleteSponsorContact } from "@/app/[locale]/(app)/patrocinadores/actions";
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
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

export function DeleteSponsorContactDialog({ id }: { id: string }) {
  const t = useTranslations("Patrocinadores");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteSponsorContact, {});
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">{t("deleteContactSr")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteContactTitle")}</DialogTitle>
          <DialogDescription>{t("deleteContactDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          {state.error ? (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("deleteContactButton")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
