"use client";

import { useActionState } from "react";
import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { generatePlayerCharges } from "@/app/[locale]/(app)/cuotas/actions";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

type TeamOption = { id: string; label: string };

export function GeneratePlayerChargesDialog({
  seasonId,
  teamOptions,
}: {
  seasonId: string;
  teamOptions: TeamOption[];
}) {
  const t = useTranslations("Cuotas");
  const [open, setOpen] = useDialogParam("generar-cargos-jugador");
  const [state, formAction] = useActionState(generatePlayerCharges, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UsersIcon data-icon="inline-start" />
        {t("generatePlayerChargesAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generatePlayerChargesTitle")}</DialogTitle>
          <DialogDescription>{t("generatePlayerChargesDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="seasonId" value={seasonId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="gen-player-team">{t("teamLabel")}</FieldLabel>
              <Select name="teamId">
                <SelectTrigger id="gen-player-team" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      teamOptions.find((option) => option.id === value)?.label ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("generatePlayerChargesAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
