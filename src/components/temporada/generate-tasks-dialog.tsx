"use client";

import { useActionState, useState } from "react";
import { ListChecksIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { generateSeasonTasks } from "@/app/[locale]/(app)/temporadas/actions";
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

export function GenerateTasksDialog({ seasonId }: { seasonId: string }) {
  const t = useTranslations("Temporadas");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(generateSeasonTasks, {});
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ListChecksIcon data-icon="inline-start" />
        {t("generateAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>{t("generateDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="seasonId" value={seasonId} />
          {state.error ? (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("generateAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
