"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createAccount,
  deleteAccount,
  updateAccount,
} from "@/app/[locale]/(app)/economia/cuentas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import type { Ledger } from "@/lib/economia";

export type AccountRow = {
  id: string;
  name: string;
  kind: "bank" | "cash";
  ledger: Ledger;
  iban: string | null;
  openingBalanceCents: number;
  openingBalanceOn: string | null;
  isActive: boolean;
};

type AccountDialogProps = {
  /** Libro activo: el que toma una cuenta nueva por defecto. */
  ledger: Ledger;
  /**
   * Libros en los que este usuario puede escribir. Con uno solo, el libro va en
   * un campo oculto: no hay nada que elegir, y mover la cuenta al otro exigiría
   * las dos `manage` (lo comprueba también la Server Action).
   */
  manageableLedgers: readonly Ledger[];
} & ({ mode: "create" } | { mode: "edit"; account: AccountRow });

export function AccountDialog(props: AccountDialogProps) {
  const t = useTranslations("Economia");
  const account = props.mode === "edit" ? props.account : null;
  const [open, setOpen] = useDialogParam(
    account ? `cuenta:${account.id}` : "cuenta-nueva",
  );
  const [state, action] = useActionState(account ? updateAccount : createAccount, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const defaultLedger = account?.ledger ?? props.ledger;
  const canChooseLedger = props.manageableLedgers.length > 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {account ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editAccountSr", { name: account.name })}</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createAccount")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? t("editAccountTitle") : t("newAccountTitle")}</DialogTitle>
        </DialogHeader>
        <form action={action}>
          {account ? <input type="hidden" name="id" value={account.id} /> : null}
          {canChooseLedger ? null : (
            <input type="hidden" name="ledger" value={defaultLedger} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-name">{t("accountNameLabel")}</FieldLabel>
              <Input
                id="account-name"
                name="name"
                defaultValue={account?.name ?? ""}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="account-kind">{t("accountKindLabel")}</FieldLabel>
                <Select name="kind" defaultValue={account?.kind ?? "bank"}>
                  <SelectTrigger id="account-kind" className="w-full">
                    <SelectValue>
                      {(value: string) => t(`accountKind_${value === "cash" ? "cash" : "bank"}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">{t("accountKind_bank")}</SelectItem>
                    <SelectItem value="cash">{t("accountKind_cash")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {canChooseLedger ? (
                <Field>
                  <FieldLabel htmlFor="account-ledger">{t("ledgerLabel")}</FieldLabel>
                  <Select name="ledger" defaultValue={defaultLedger}>
                    <SelectTrigger id="account-ledger" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          t(`ledger_${value === "internal" ? "internal" : "official"}`)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {props.manageableLedgers.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`ledger_${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
            <Field>
              <FieldLabel htmlFor="account-iban">{t("accountIbanLabel")}</FieldLabel>
              <Input
                id="account-iban"
                name="iban"
                defaultValue={account?.iban ?? ""}
                placeholder={t("accountIbanPlaceholder")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="account-opening-balance">
                  {t("openingBalanceLabel")}
                </FieldLabel>
                <Input
                  id="account-opening-balance"
                  name="openingBalance"
                  inputMode="decimal"
                  defaultValue={
                    account ? String(account.openingBalanceCents / 100) : ""
                  }
                  placeholder="0"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-opening-balance-on">
                  {t("openingBalanceOnLabel")}
                </FieldLabel>
                <Input
                  id="account-opening-balance-on"
                  name="openingBalanceOn"
                  type="date"
                  defaultValue={account?.openingBalanceOn ?? ""}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="account-active"
                name="isActive"
                defaultChecked={account ? account.isActive : true}
              />
              <Label htmlFor="account-active" className="font-normal">
                {t("accountActiveLabel")}
              </Label>
            </Field>
            <FormError message={state.error} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>{account ? t("saveChanges") : t("createAccount")}</SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAccountDialog({ id, name }: { id: string; name: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Economia"
      entityKey="Account"
      paramKey="borrar-cuenta"
      values={{ name }}
      deleteAction={deleteAccount}
    />
  );
}
