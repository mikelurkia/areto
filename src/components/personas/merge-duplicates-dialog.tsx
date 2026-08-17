"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { mergePersons } from "@/app/[locale]/(app)/personas/duplicados/actions";
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

type CandidatePerson = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
};

export function MergeDuplicatesDialog({
  candidates,
}: {
  candidates: CandidatePerson[];
}) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(`fusionar:${candidates.map((c) => c.id).toSorted().join("_")}`);
  const [state, formAction] = useActionState(mergePersons, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  function label(id: string) {
    const person = candidates.find((p) => p.id === id);
    if (!person) return "";
    return `${person.firstName} ${person.lastName}${person.nationalId ? ` · ${person.nationalId}` : ""}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {t("mergeAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mergeTitle")}</DialogTitle>
          <DialogDescription>{t("mergeDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="merge-primary">
                {t("mergeKeepLabel")}
              </FieldLabel>
              <Select name="primaryId" defaultValue={candidates[0]?.id}>
                <SelectTrigger id="merge-primary" className="w-full">
                  <SelectValue>{(value: string) => label(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {label(person.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="merge-duplicate">
                {t("mergeRemoveLabel")}
              </FieldLabel>
              <Select name="duplicateId" defaultValue={candidates[1]?.id}>
                <SelectTrigger id="merge-duplicate" className="w-full">
                  <SelectValue>{(value: string) => label(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {label(person.id)}
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
              <SubmitButton variant="destructive">
                {t("mergeConfirmButton")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
