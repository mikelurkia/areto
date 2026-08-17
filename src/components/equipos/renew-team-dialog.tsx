"use client";

import { useActionState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { renewTeam } from "@/app/[locale]/(app)/equipos/actions";
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

type SeasonOption = { id: string; name: string; isCurrent: boolean };

export function RenewTeamDialog({
  teamId,
  teamName,
  seasons,
}: {
  teamId: string;
  teamName: string;
  seasons: SeasonOption[];
}) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useDialogParam(`renovar-equipo:${teamId}`);
  const [state, formAction] = useActionState(renewTeam, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  if (seasons.length === 0) return null;

  const defaultSeasonId = seasons.find((s) => s.isCurrent)?.id ?? seasons[0].id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <RefreshCwIcon data-icon="inline-start" />
        {t("renewTeamAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renewTeamTitle", { name: teamName })}</DialogTitle>
          <DialogDescription>{t("renewTeamDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="teamId" value={teamId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="renew-target-season">
                {t("targetSeasonLabel")}
              </FieldLabel>
              <Select name="targetSeasonId" defaultValue={defaultSeasonId}>
                <SelectTrigger id="renew-target-season" className="w-full">
                  <SelectValue>
                    {(value: string) => seasons.find((s) => s.id === value)?.name ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isCurrent ? ` (${t("currentBadge")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>{t("renewTeamAction")}</SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
