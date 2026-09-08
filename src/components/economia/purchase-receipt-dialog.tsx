"use client";

import { useActionState } from "react";
import { ChevronDownIcon, ChevronUpIcon, PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createPurchaseReceipt,
  deletePurchaseReceipt,
  updatePurchaseReceipt,
} from "@/app/[locale]/(app)/economia/tickets/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import {
  PurchaseReceiptPersonCombobox,
  type PersonOption,
} from "@/components/economia/purchase-receipt-person-combobox";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import type { Ledger } from "@/lib/economia";

export type PurchaseReceiptRow = {
  id: string;
  ledger: Ledger;
  seasonId: string;
  teamId: string | null;
  categoryId: string | null;
  paidByPersonId: string | null;
  purchasedOn: string;
  description: string;
  totalCents: number;
  notes: string | null;
};

export type NamedOption = { id: string; name: string };

type PurchaseReceiptDialogProps = {
  /** Libro activo: el que toma un ticket nuevo por defecto. */
  ledger: Ledger;
  manageableLedgers: readonly Ledger[];
  seasons: NamedOption[];
  teams: NamedOption[];
  categories: NamedOption[];
  personOptions: PersonOption[];
} & (
  | { mode: "create" }
  | { mode: "edit"; receipt: PurchaseReceiptRow; fileName: string | null; fileUrl: string | null }
);

function amountValue(cents: number): string {
  return String(cents / 100);
}

export function PurchaseReceiptDialog(props: PurchaseReceiptDialogProps) {
  const t = useTranslations("Economia");
  const receipt = props.mode === "edit" ? props.receipt : null;
  const [open, setOpen] = useDialogParam(
    receipt ? `ticket:${receipt.id}` : "ticket-nuevo",
  );
  const [state, action] = useActionState(
    receipt ? updatePurchaseReceipt : createPurchaseReceipt,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const nameOf = (options: NamedOption[], id: string | null) =>
    options.find((option) => option.id === id)?.name ?? "";

  const defaultLedger = receipt?.ledger ?? props.ledger;
  const canChooseLedger = props.manageableLedgers.length > 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {receipt ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editPurchaseReceiptSr", { description: receipt.description })}
          </span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createPurchaseReceipt")}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {receipt ? t("editPurchaseReceiptTitle") : t("newPurchaseReceiptTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={action}>
          {receipt ? <input type="hidden" name="id" value={receipt.id} /> : null}
          {canChooseLedger ? null : <input type="hidden" name="ledger" value={defaultLedger} />}
          <FieldGroup>
            <FormError message={state.error} />
            <Field>
              <FieldLabel htmlFor="ticket-description">{t("ticketDescriptionLabel")}</FieldLabel>
              <Input
                id="ticket-description"
                name="description"
                defaultValue={receipt?.description ?? ""}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ticket-paid-by">{t("ticketPaidByLabel")}</FieldLabel>
                <PurchaseReceiptPersonCombobox
                  personOptions={props.personOptions}
                  defaultPersonId={receipt?.paidByPersonId ?? null}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ticket-purchased-on">
                  {t("ticketPurchasedOnLabel")}
                </FieldLabel>
                <Input
                  id="ticket-purchased-on"
                  name="purchasedOn"
                  type="date"
                  defaultValue={receipt?.purchasedOn ?? ""}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ticket-season">{t("movementSeasonLabel")}</FieldLabel>
              <Select name="seasonId" defaultValue={receipt?.seasonId ?? props.seasons[0]?.id ?? ""}>
                <SelectTrigger id="ticket-season" className="w-full">
                  <SelectValue>{(value: string) => nameOf(props.seasons, value)}</SelectValue>
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
            {canChooseLedger ? (
              <Field>
                <FieldLabel htmlFor="ticket-ledger">{t("ledgerLabel")}</FieldLabel>
                <Select name="ledger" defaultValue={defaultLedger}>
                  <SelectTrigger id="ticket-ledger" className="w-full">
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
            <Field>
              <FieldLabel htmlFor="ticket-total">{t("invoiceTotalLabel")}</FieldLabel>
              <Input
                id="ticket-total"
                name="total"
                inputMode="decimal"
                defaultValue={receipt ? amountValue(receipt.totalCents) : ""}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ticket-file">{t("invoiceFileLabel")}</FieldLabel>
              {props.mode === "edit" && props.fileUrl ? (
                <a
                  href={props.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {props.fileName ?? t("invoiceFileLabel")}
                </a>
              ) : null}
              <Input
                id="ticket-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
              {props.mode === "edit" && props.fileUrl ? (
                <Field orientation="horizontal" className="mt-1">
                  <Checkbox id="ticket-remove-file" name="removeFile" />
                  <Label htmlFor="ticket-remove-file" className="font-normal">
                    {t("removeFileLabel")}
                  </Label>
                </Field>
              ) : null}
            </Field>
            <Collapsible
              defaultOpen={Boolean(receipt?.teamId || receipt?.categoryId || receipt?.notes)}
              className="flex flex-col gap-3"
            >
              <CollapsibleTrigger
                render={<button type="button" />}
                className="group/ticket-details flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronDownIcon className="size-4 shrink-0 group-aria-expanded/ticket-details:hidden" />
                <ChevronUpIcon className="hidden size-4 shrink-0 group-aria-expanded/ticket-details:block" />
                {t("ticketMoreDetailsLabel")}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <FieldGroup>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="ticket-team">{t("invoiceTeamLabel")}</FieldLabel>
                      <Select name="teamId" defaultValue={receipt?.teamId ?? "none"}>
                        <SelectTrigger id="ticket-team" className="w-full">
                          <SelectValue>
                            {(value: string) => nameOf(props.teams, value) || t("invoiceTeamNone")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("invoiceTeamNone")}</SelectItem>
                          {props.teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ticket-category">{t("categoryLabel")}</FieldLabel>
                      <Select name="categoryId" defaultValue={receipt?.categoryId ?? "none"}>
                        <SelectTrigger id="ticket-category" className="w-full">
                          <SelectValue>
                            {(value: string) => nameOf(props.categories, value) || t("categoryNone")}
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
                  </div>
                  <Field>
                    <FieldLabel htmlFor="ticket-notes">{t("notesLabel")}</FieldLabel>
                    <Textarea
                      id="ticket-notes"
                      name="notes"
                      rows={2}
                      defaultValue={receipt?.notes ?? ""}
                    />
                  </Field>
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {receipt ? t("saveChanges") : t("createPurchaseReceipt")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePurchaseReceiptDialog({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Economia"
      entityKey="PurchaseReceipt"
      paramKey="borrar-ticket"
      values={{ description }}
      deleteAction={deletePurchaseReceipt}
    />
  );
}
