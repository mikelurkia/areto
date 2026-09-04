"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createIssuedInvoice,
  updateIssuedInvoice,
} from "@/app/[locale]/(app)/economia/emitidas/actions";
import { issueSponsorInvoice } from "@/app/[locale]/(app)/patrocinadores/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import type { Ledger } from "@/lib/economia";

export type IssuedInvoiceRow = {
  id: string;
  ledger: Ledger;
  number: string;
  seasonId: string;
  categoryId: string | null;
  customerName: string;
  customerTaxId: string | null;
  customerAddress: string | null;
  issuedOn: string;
  dueDate: string | null;
  concept: string | null;
  baseCents: number;
  vatCents: number;
  withholdingCents: number;
  totalCents: number;
  status: "issued" | "rectified" | "cancelled";
  notes: string | null;
};

export type NamedOption = { id: string; name: string };

/** Lo que trae precargado la emisión desde una anualidad de patrocinio. */
export type SponsorInvoiceDefaults = {
  sponsorPaymentId: string;
  seasonId: string;
  customerName: string;
  customerTaxId: string | null;
  customerAddress: string | null;
  concept: string;
  totalCents: number;
};

type IssuedInvoiceDialogProps = {
  /** Libro activo: el que toma una factura nueva por defecto. */
  ledger: Ledger;
  manageableLedgers: readonly Ledger[];
  seasons: NamedOption[];
  categories: NamedOption[];
} & (
  | { mode: "create" }
  | { mode: "edit"; invoice: IssuedInvoiceRow; fileName: string | null; fileUrl: string | null }
  | { mode: "sponsor"; defaults: SponsorInvoiceDefaults }
);

function amountValue(cents: number): string {
  return String(cents / 100);
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/**
 * Alta y edición de una factura emitida, y también la emisión desde una
 * anualidad de patrocinio (`mode: "sponsor"`), que es la misma factura con los
 * datos del patrocinador ya congelados y solo el desglose fiscal por decidir.
 *
 * El NÚMERO no está en el formulario: lo reserva el servidor de forma atómica
 * al emitir, y una vez puesto no se cambia.
 */
export function IssuedInvoiceDialog(props: IssuedInvoiceDialogProps) {
  const t = useTranslations("Economia");
  const invoice = props.mode === "edit" ? props.invoice : null;
  const sponsorDefaults = props.mode === "sponsor" ? props.defaults : null;

  const [open, setOpen] = useDialogParam(
    invoice
      ? `emitida:${invoice.id}`
      : sponsorDefaults
        ? `emitir:${sponsorDefaults.sponsorPaymentId}`
        : "emitida-nueva",
  );
  const [state, action] = useActionState(
    invoice ? updateIssuedInvoice : sponsorDefaults ? issueSponsorInvoice : createIssuedInvoice,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const nameOf = (options: NamedOption[], id: string | null) =>
    options.find((option) => option.id === id)?.name ?? "";

  const defaultLedger = invoice?.ledger ?? props.ledger;
  // Una factura de patrocinio es siempre del libro oficial, y el libro de una
  // factura ya emitida no se mueve.
  const canChooseLedger = props.mode === "create" && props.manageableLedgers.length > 1;

  const defaultTotal = invoice
    ? amountValue(invoice.totalCents)
    : sponsorDefaults
      ? amountValue(sponsorDefaults.totalCents)
      : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {invoice ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editIssuedInvoiceSr", { number: invoice.number })}</span>
        </DialogTrigger>
      ) : sponsorDefaults ? (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <ReceiptTextIcon data-icon="inline-start" />
          {t("issueInvoiceAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createIssuedInvoice")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {invoice ? t("editIssuedInvoiceTitle") : t("newIssuedInvoiceTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={action}>
          {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}
          {sponsorDefaults ? (
            <input type="hidden" name="id" value={sponsorDefaults.sponsorPaymentId} />
          ) : null}
          {canChooseLedger ? null : <input type="hidden" name="ledger" value={defaultLedger} />}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="issued-customer">{t("customerNameLabel")}</FieldLabel>
                <Input
                  id="issued-customer"
                  name="customerName"
                  defaultValue={invoice?.customerName ?? sponsorDefaults?.customerName ?? ""}
                  readOnly={Boolean(sponsorDefaults)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issued-customer-tax-id">{t("customerTaxIdLabel")}</FieldLabel>
                <Input
                  id="issued-customer-tax-id"
                  name="customerTaxId"
                  defaultValue={invoice?.customerTaxId ?? sponsorDefaults?.customerTaxId ?? ""}
                  readOnly={Boolean(sponsorDefaults)}
                />
              </Field>
            </div>
            {sponsorDefaults ? null : (
              <Field>
                <FieldLabel htmlFor="issued-customer-address">
                  {t("customerAddressLabel")}
                </FieldLabel>
                <Input
                  id="issued-customer-address"
                  name="customerAddress"
                  defaultValue={invoice?.customerAddress ?? ""}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="issued-season">{t("movementSeasonLabel")}</FieldLabel>
                <Select
                  name="seasonId"
                  defaultValue={
                    invoice?.seasonId ?? sponsorDefaults?.seasonId ?? props.seasons[0]?.id ?? ""
                  }
                >
                  <SelectTrigger id="issued-season" className="w-full">
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
                <FieldLabel htmlFor="issued-category">{t("categoryLabel")}</FieldLabel>
                <Select name="categoryId" defaultValue={invoice?.categoryId ?? "none"}>
                  <SelectTrigger id="issued-category" className="w-full">
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
            {canChooseLedger ? (
              <Field>
                <FieldLabel htmlFor="issued-ledger">{t("ledgerLabel")}</FieldLabel>
                <Select name="ledger" defaultValue={defaultLedger}>
                  <SelectTrigger id="issued-ledger" className="w-full">
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
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="issued-issued-on">{t("invoiceIssuedOnLabel")}</FieldLabel>
                <Input
                  id="issued-issued-on"
                  name="issuedOn"
                  type="date"
                  defaultValue={invoice?.issuedOn ?? TODAY()}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issued-due-date">{t("invoiceDueDateLabel")}</FieldLabel>
                <Input
                  id="issued-due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={invoice?.dueDate ?? ""}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="issued-base">{t("invoiceBaseLabel")}</FieldLabel>
                <Input
                  id="issued-base"
                  name="base"
                  inputMode="decimal"
                  defaultValue={defaultTotal}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issued-vat">{t("invoiceVatLabel")}</FieldLabel>
                <Input
                  id="issued-vat"
                  name="vat"
                  inputMode="decimal"
                  defaultValue={invoice ? amountValue(invoice.vatCents) : "0"}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="issued-withholding">
                  {t("invoiceWithholdingLabel")}
                </FieldLabel>
                <Input
                  id="issued-withholding"
                  name="withholding"
                  inputMode="decimal"
                  defaultValue={invoice ? amountValue(invoice.withholdingCents) : "0"}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issued-total">{t("invoiceTotalLabel")}</FieldLabel>
                <Input
                  id="issued-total"
                  name="total"
                  inputMode="decimal"
                  defaultValue={defaultTotal}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="issued-concept">{t("conceptLabel")}</FieldLabel>
              <Input
                id="issued-concept"
                name="concept"
                defaultValue={invoice?.concept ?? sponsorDefaults?.concept ?? ""}
              />
            </Field>
            {sponsorDefaults ? null : (
              <Field>
                <FieldLabel htmlFor="issued-file">{t("invoiceFileLabel")}</FieldLabel>
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
                  id="issued-file"
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                />
                {props.mode === "edit" && props.fileUrl ? (
                  <Field orientation="horizontal" className="mt-1">
                    <Checkbox id="issued-remove-file" name="removeFile" />
                    <Label htmlFor="issued-remove-file" className="font-normal">
                      {t("removeFileLabel")}
                    </Label>
                  </Field>
                ) : null}
              </Field>
            )}
            {sponsorDefaults ? null : (
              <Field>
                <FieldLabel htmlFor="issued-notes">{t("notesLabel")}</FieldLabel>
                <Textarea
                  id="issued-notes"
                  name="notes"
                  rows={2}
                  defaultValue={invoice?.notes ?? ""}
                />
              </Field>
            )}
            <FormError message={state.error} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {invoice ? t("saveChanges") : t("issueInvoiceAction")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
