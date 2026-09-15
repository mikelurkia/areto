"use client";

import { useActionState } from "react";
import { ArrowRightLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { moveMembership } from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { FormError } from "@/components/form-error";
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

export function MoveMembershipDialog({
  id,
  name,
  teams,
}: {
  id: string;
  name: string;
  teams: { id: string; name: string }[];
}) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useDialogParam(`mover-membresia:${id}`);
  const [state, formAction] = useActionState(moveMembership, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  if (teams.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <ArrowRightLeftIcon />
        <span className="sr-only">{t("moveMemberSr", { name })}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("moveMemberTitle", { name })}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <FieldGroup>
            <FormError message={state.error} />
            <Field>
              <FieldLabel htmlFor="move-membership-team">{t("teamLabel")}</FieldLabel>
              <Select name="targetTeamId">
                <SelectTrigger id="move-membership-team" className="w-full">
                  <SelectValue placeholder={t("selectTeam")}>
                    {(value: string) =>
                      teams.find((team) => team.id === value)?.name ?? t("selectTeam")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>{t("moveMemberAction")}</SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
