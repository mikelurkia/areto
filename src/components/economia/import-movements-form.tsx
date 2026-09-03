"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { importMovements } from "@/app/[locale]/(app)/economia/movimientos/importar/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
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

type NamedOption = { id: string; name: string };

export function ImportMovementsForm({ accounts }: { accounts: NamedOption[] }) {
  const t = useTranslations("Economia");
  const [state, formAction] = useActionState(importMovements, {});
  useActionToast(state);

  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="import-account">{t("movementAccountLabel")}</FieldLabel>
          <Select name="accountId" defaultValue={accounts[0]?.id ?? ""}>
            <SelectTrigger id="import-account" className="w-full">
              <SelectValue>{(value: string) => nameOf(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-format">{t("importFormatLabel")}</FieldLabel>
          <Select name="format" defaultValue="n43">
            <SelectTrigger id="import-format" className="w-full">
              <SelectValue>
                {(value: string) => t(value === "n43" ? "importFormatN43" : "importFormatCsv")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="n43">{t("importFormatN43")}</SelectItem>
              <SelectItem value="csv">{t("importFormatCsv")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-file">{t("importFileLabel")}</FieldLabel>
          <Input id="import-file" name="file" type="file" accept=".n43,.csv,.txt" required />
        </Field>
        <FormError message={state.error} />
        <SubmitButton className="self-start">{t("importAction")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
