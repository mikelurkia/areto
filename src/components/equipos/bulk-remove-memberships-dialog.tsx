"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { removeMemberships } from "@/app/[locale]/(app)/equipos/[teamId]/actions";
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
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

export function BulkRemoveMembershipsDialog({
  ids,
  onSuccess,
}: {
  ids: string[];
  onSuccess: () => void;
}) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(removeMemberships, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);
  useActionResult(state, (result) => {
    if (result.message) onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>
        {t("rosterBulkRemoveAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rosterBulkRemoveTitle", { count: ids.length })}</DialogTitle>
          <DialogDescription>
            {t("rosterBulkRemoveDescription", { count: ids.length })}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          {ids.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">
              {t("rosterBulkRemoveButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
