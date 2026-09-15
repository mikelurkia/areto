"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createReceivedInvoice,
  deleteReceivedInvoice,
  updateReceivedInvoice,
} from "@/app/[locale]/(app)/economia/recibidas/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { FormError } from "@/components/form-error";
import { InvoiceAttachmentFields, InvoiceFiscalFields } from "@/components/economia/invoice-form-fields";
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
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import type { Ledger } from "@/lib/economia";

export type ReceivedInvoiceRow = {
  id: string;
  ledger: Ledger;
  supplierId: string;
  seasonId: string;
  teamId: string | null;
  categoryId: string | null;
  invoiceNumber: string;
  issuedOn: string;
  dueDate: string | null;
  baseCents: number;
  vatCents: number;
  withholdingCents: number;
  totalCents: number;
  status: "pending" | "paid" | "disputed";
  description: string | null;
  notes: string | null;
};

export type NamedOption = { id: string; name: string };

type ReceivedInvoiceDialogProps = {
  /** Libro activo: el que toma una factura nueva por defecto. */
  ledger: Ledger;
  manageableLedgers: readonly Ledger[];
  suppliers: NamedOption[];
  seasons: NamedOption[];
  teams: NamedOption[];
  categories: NamedOption[];
} & (
  | { mode: "create" }
  | { mode: "edit"; invoice: ReceivedInvoiceRow; fileName: string | null; fileUrl: string | null }
);

function amountValue(cents: number): string {
  return String(cents / 100);
}

export function ReceivedInvoiceDialog(props: ReceivedInvoiceDialogProps) {
  const t = useTranslations("Economia");
  const invoice = props.mode === "edit" ? props.invoice : null;
  const [open, setOpen] = useDialogParam(
    invoice ? `recibida:${invoice.id}` : "recibida-nueva",
  );
  const [state, action] = useActionState(
    invoice ? updateReceivedInvoice : createReceivedInvoice,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const nameOf = (options: NamedOption[], id: string | null) =>
    options.find((option) => option.id === id)?.name ?? "";

  const defaultLedger = invoice?.ledger ?? props.ledger;
  const canChooseLedger = props.manageableLedgers.length > 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {invoice ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editReceivedInvoiceSr", { number: invoice.invoiceNumber })}
          </span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createReceivedInvoice")}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {invoice ? t("editReceivedInvoiceTitle") : t("newReceivedInvoiceTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={action}>
          {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}
          {canChooseLedger ? null : <input type="hidden" name="ledger" value={defaultLedger} />}
          <FieldGroup>
            <FormError message={state.error} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="invoice-supplier">{t("invoiceSupplierLabel")}</FieldLabel>
                <Select
                  name="supplierId"
                  defaultValue={invoice?.supplierId ?? props.suppliers[0]?.id ?? ""}
                >
                  <SelectTrigger id="invoice-supplier" className="w-full">
                    <SelectValue>
                      {(value: string) => nameOf(props.suppliers, value)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {props.suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="invoice-number">{t("invoiceNumberLabel")}</FieldLabel>
                <Input
                  id="invoice-number"
                  name="invoiceNumber"
                  defaultValue={invoice?.invoiceNumber ?? ""}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="invoice-season">{t("movementSeasonLabel")}</FieldLabel>
                <Select name="seasonId" defaultValue={invoice?.seasonId ?? props.seasons[0]?.id ?? ""}>
                  <SelectTrigger id="invoice-season" className="w-full">
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
              <Field>
                <FieldLabel htmlFor="invoice-team">{t("invoiceTeamLabel")}</FieldLabel>
                <Select name="teamId" defaultValue={invoice?.teamId ?? "none"}>
                  <SelectTrigger id="invoice-team" className="w-full">
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
            </div>
            {canChooseLedger ? (
              <Field>
                <FieldLabel htmlFor="invoice-ledger">{t("ledgerLabel")}</FieldLabel>
                <Select name="ledger" defaultValue={defaultLedger}>
                  <SelectTrigger id="invoice-ledger" className="w-full">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="invoice-issued-on">{t("invoiceIssuedOnLabel")}</FieldLabel>
                <Input
                  id="invoice-issued-on"
                  name="issuedOn"
                  type="date"
                  defaultValue={invoice?.issuedOn ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invoice-due-date">{t("invoiceDueDateLabel")}</FieldLabel>
                <Input
                  id="invoice-due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={invoice?.dueDate ?? ""}
                />
              </Field>
            </div>
            <InvoiceFiscalFields
              idPrefix="invoice"
              t={t}
              baseDefault={invoice ? amountValue(invoice.baseCents) : ""}
              vatDefault={invoice ? amountValue(invoice.vatCents) : "0"}
              withholdingDefault={invoice ? amountValue(invoice.withholdingCents) : "0"}
              totalDefault={invoice ? amountValue(invoice.totalCents) : ""}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="invoice-category">{t("categoryLabel")}</FieldLabel>
                <Select name="categoryId" defaultValue={invoice?.categoryId ?? "none"}>
                  <SelectTrigger id="invoice-category" className="w-full">
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
              <Field>
                <FieldLabel htmlFor="invoice-status">{t("invoiceStatusLabel")}</FieldLabel>
                <Select
                  key={invoice?.status ?? "pending"}
                  name="status"
                  defaultValue={invoice?.status ?? "pending"}
                >
                  <SelectTrigger id="invoice-status" className="w-full">
                    <SelectValue>
                      {(value: string) => t(`invoiceStatus_${value}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("invoiceStatus_pending")}</SelectItem>
                    <SelectItem value="paid">{t("invoiceStatus_paid")}</SelectItem>
                    <SelectItem value="disputed">{t("invoiceStatus_disputed")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="invoice-description">
                {t("invoiceDescriptionLabel")}
              </FieldLabel>
              <Input
                id="invoice-description"
                name="description"
                defaultValue={invoice?.description ?? ""}
              />
            </Field>
            <InvoiceAttachmentFields
              idPrefix="invoice"
              t={t}
              fileUrl={props.mode === "edit" ? props.fileUrl : null}
              fileName={props.mode === "edit" ? props.fileName : null}
              notes={invoice?.notes ?? null}
            />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {invoice ? t("saveChanges") : t("createReceivedInvoice")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteReceivedInvoiceDialog({ id, number }: { id: string; number: string }) {
  return (
    <DeleteEntityDialog
      id={id}
      namespace="Economia"
      entityKey="ReceivedInvoice"
      paramKey="borrar-recibida"
      values={{ number }}
      deleteAction={deleteReceivedInvoice}
    />
  );
}
