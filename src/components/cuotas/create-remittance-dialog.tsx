"use client";

import { useActionState, useMemo, useState } from "react";
import { FileOutputIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { createRemittance } from "@/app/[locale]/(app)/cuotas/actions";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useRouter } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";

type TeamOption = { id: string; label: string };
type PeriodOption = {
  kind: "player" | "member";
  teamId: string | null;
  periodKey: string;
  count: number;
  amountCents: number;
};

export function CreateRemittanceDialog({
  seasonId,
  teamOptions,
  periodOptions,
}: {
  seasonId: string;
  teamOptions: TeamOption[];
  periodOptions: PeriodOption[];
}) {
  const t = useTranslations("Cuotas");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useDialogParam("crear-remesa");
  const [kind, setKind] = useState<"player" | "member">("player");
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [periodKey, setPeriodKey] = useState<string | undefined>(undefined);
  const [state, formAction] = useActionState(createRemittance, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);
  useActionResult(state, (result) => {
    if (result.remittanceId) router.push(`/cuotas/${result.remittanceId}`);
  });

  const availableOptions = useMemo(
    () =>
      periodOptions.filter(
        (option) => option.kind === kind && (kind === "member" || option.teamId === teamId),
      ),
    [periodOptions, kind, teamId],
  );
  const selectedOption = availableOptions.find((option) => option.periodKey === periodKey);

  function handleKindChange(value: string | null) {
    setKind((value as "player" | "member") ?? "player");
    setTeamId(undefined);
    setPeriodKey(undefined);
  }

  function handleTeamChange(value: string | null) {
    setTeamId(value ?? undefined);
    setPeriodKey(undefined);
  }

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
          <FormError message={state.error} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rem-kind">{t("kindLabel")}</FieldLabel>
              <Select name="kind" value={kind} onValueChange={handleKindChange}>
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
                <Select name="teamId" value={teamId} onValueChange={handleTeamChange}>
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
              <Select
                name="periodKey"
                value={periodKey}
                onValueChange={(value) => setPeriodKey(value ?? undefined)}
                disabled={availableOptions.length === 0}
              >
                <SelectTrigger id="rem-period" className="w-full">
                  <SelectValue placeholder={t("periodKeyPlaceholder")}>
                    {(value: string) => value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableOptions.map((option) => (
                    <SelectItem key={option.periodKey} value={option.periodKey}>
                      {option.periodKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {selectedOption
                  ? t("periodKeySummary", {
                      count: selectedOption.count,
                      amount: formatCents(selectedOption.amountCents, locale),
                    })
                  : t("periodKeyEmpty")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="rem-date">{t("collectionDateLabel")}</FieldLabel>
              <Input id="rem-date" name="collectionDate" type="date" required />
            </Field>
          </FieldGroup>
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
