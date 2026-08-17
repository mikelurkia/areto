"use client";

import { useActionState } from "react";
import { LayersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { generateAnnualities } from "@/app/[locale]/(app)/patrocinadores/actions";
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

type TermOption = { id: string; label: string };

export function GenerateAnnualitiesDialog({
  termOptions,
  defaultTermId,
  defaultFirstYear,
}: {
  termOptions: TermOption[];
  defaultTermId: string;
  defaultFirstYear: number;
}) {
  const t = useTranslations("Patrocinadores");
  const [open, setOpen] = useDialogParam(`generar-anualidades:${defaultTermId}`);
  const [state, formAction] = useActionState(generateAnnualities, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <LayersIcon data-icon="inline-start" />
        {t("generateAnnualitiesAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generateAnnualitiesTitle")}</DialogTitle>
          <DialogDescription>{t("generateAnnualitiesDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="gen-term">{t("paymentTermLabel")}</FieldLabel>
              <Select name="termId" defaultValue={defaultTermId}>
                <SelectTrigger id="gen-term" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      termOptions.find((option) => option.id === value)?.label ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {termOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor="gen-first-year">{t("firstYearLabel")}</FieldLabel>
                <Input
                  id="gen-first-year"
                  name="firstYear"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={String(defaultFirstYear)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-count">{t("seasonsCountLabel")}</FieldLabel>
                <Input
                  id="gen-count"
                  name="count"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue="1"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-amount">{t("totalAmountLabel")}</FieldLabel>
                <Input
                  id="gen-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="6000"
                />
              </Field>
            </div>
          </FieldGroup>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("generateAnnualitiesAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
