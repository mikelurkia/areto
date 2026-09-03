"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createMovement,
  deleteMovement,
  updateMovement,
} from "@/app/[locale]/(app)/economia/movimientos/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

export type MovementRow = {
  id: string;
  accountId: string;
  accountName: string;
  seasonId: string;
  bookedOn: string;
  valueOn: string | null;
  amountCents: number;
  concept: string;
  counterparty: string | null;
  balanceCents: number | null;
  categoryId: string | null;
  categoryName: string | null;
  source: "import" | "manual";
  notes: string | null;
};

export type NamedOption = { id: string; name: string };

type MovementDialogProps = {
  /** Cuentas del libro activo en las que este usuario puede escribir. */
  accounts: NamedOption[];
  seasons: NamedOption[];
  categories: NamedOption[];
  /** Temporada del listado: la que toma un apunte nuevo. */
  seasonId: string;
} & ({ mode: "create" } | { mode: "edit"; movement: MovementRow });

/** Céntimos → el texto con el que se rellena el campo de importe ("-45.5"). */
function amountValue(cents: number | null): string {
  return cents === null ? "" : String(cents / 100);
}

export function MovementDialog(props: MovementDialogProps) {
  const t = useTranslations("Economia");
  const movement = props.mode === "edit" ? props.movement : null;
  const [open, setOpen] = useDialogParam(
    movement ? `apunte:${movement.id}` : "apunte-nuevo",
  );
  const [state, action] = useActionState(movement ? updateMovement : createMovement, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const nameOf = (options: NamedOption[], id: string) =>
    options.find((option) => option.id === id)?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {movement ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editMovementSr", { concept: movement.concept })}
          </span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createMovement")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {movement ? t("editMovementTitle") : t("newMovementTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={action}>
          {movement ? <input type="hidden" name="id" value={movement.id} /> : null}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="movement-account">
                  {t("movementAccountLabel")}
                </FieldLabel>
                <Select
                  name="accountId"
                  defaultValue={movement?.accountId ?? props.accounts[0]?.id ?? ""}
                >
                  <SelectTrigger id="movement-account" className="w-full">
                    <SelectValue>
                      {(value: string) => nameOf(props.accounts, value)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {props.accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="movement-season">
                  {t("movementSeasonLabel")}
                </FieldLabel>
                <Select name="seasonId" defaultValue={movement?.seasonId ?? props.seasonId}>
                  <SelectTrigger id="movement-season" className="w-full">
                    <SelectValue>
                      {(value: string) => nameOf(props.seasons, value)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {props.seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="movement-booked-on">{t("bookedOnLabel")}</FieldLabel>
                <Input
                  id="movement-booked-on"
                  name="bookedOn"
                  type="date"
                  defaultValue={movement?.bookedOn ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="movement-value-on">{t("valueOnLabel")}</FieldLabel>
                <Input
                  id="movement-value-on"
                  name="valueOn"
                  type="date"
                  defaultValue={movement?.valueOn ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="movement-concept">{t("conceptLabel")}</FieldLabel>
              <Input
                id="movement-concept"
                name="concept"
                defaultValue={movement?.concept ?? ""}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="movement-counterparty">
                {t("counterpartyLabel")}
              </FieldLabel>
              <Input
                id="movement-counterparty"
                name="counterparty"
                defaultValue={movement?.counterparty ?? ""}
                placeholder={t("counterpartyPlaceholder")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="movement-amount">{t("amountLabel")}</FieldLabel>
                <Input
                  id="movement-amount"
                  name="amount"
                  inputMode="decimal"
                  defaultValue={movement ? amountValue(movement.amountCents) : ""}
                  placeholder={t("amountPlaceholder")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="movement-balance">{t("balanceLabel")}</FieldLabel>
                <Input
                  id="movement-balance"
                  name="balance"
                  inputMode="decimal"
                  defaultValue={movement ? amountValue(movement.balanceCents) : ""}
                  placeholder={t("balancePlaceholder")}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="movement-category">{t("categoryLabel")}</FieldLabel>
              <Select name="categoryId" defaultValue={movement?.categoryId ?? "none"}>
                <SelectTrigger id="movement-category" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      nameOf(props.categories, value) || t("categoryNone")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("categoryNone")}</SelectItem>
                  {props.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="movement-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="movement-notes"
                name="notes"
                rows={2}
                defaultValue={movement?.notes ?? ""}
              />
            </Field>
            <FormError message={state.error} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {movement ? t("saveChanges") : t("createMovement")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteMovementDialog({ id, concept }: { id: string; concept: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Economia"
      entityKey="Movement"
      paramKey="borrar-apunte"
      values={{ concept }}
      deleteAction={deleteMovement}
    />
  );
}
