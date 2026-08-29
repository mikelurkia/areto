"use client";

import { useActionState, useState } from "react";
import { FileOutputIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createRemittance } from "@/app/[locale]/(app)/cuotas/actions";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

export function CreateRemittanceDialog({
  seasonId,
  teamOptions,
}: {
  seasonId: string;
  teamOptions: TeamOption[];
}) {
  const t = useTranslations("Cuotas");
  const [open, setOpen] = useDialogParam("crear-remesa");
  const [kind, setKind] = useState<"player" | "member">("player");
  const [state, formAction] = useActionState(createRemittance, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <FileOutputIcon data-icon="inline-start" />
        {t("createRemittanceAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createRemittanceTitle")}</DialogTitle>
          <DialogDescription>{t("createRemittanceDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="seasonId" value={seasonId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rem-kind">{t("kindLabel")}</FieldLabel>
              <Select
                name="kind"
                value={kind}
                onValueChange={(v) => setKind((v as "player" | "member") ?? "player")}
              >
                <SelectTrigger id="rem-kind" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === "player" ? t("kindPlayer") : t("kindMember")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">{t("kindPlayer")}</SelectItem>
                  <SelectItem value="member">{t("kindMember")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {kind === "player" ? (
              <Field>
                <FieldLabel htmlFor="rem-team">{t("teamLabel")}</FieldLabel>
                <Select name="teamId">
                  <SelectTrigger id="rem-team" className="w-full">
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
            ) : null}
            <Field>
              <FieldLabel htmlFor="rem-period">{t("periodKeyLabel")}</FieldLabel>
              <Input id="rem-period" name="periodKey" defaultValue="season" placeholder="2026-09" />
              <FieldDescription>{t("periodKeyHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="rem-date">{t("collectionDateLabel")}</FieldLabel>
              <Input id="rem-date" name="collectionDate" type="date" required />
            </Field>
          </FieldGroup>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("createRemittanceAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
