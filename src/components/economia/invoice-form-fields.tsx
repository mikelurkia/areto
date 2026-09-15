"use client";

import { PaperclipIcon } from "lucide-react";
import type { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Translate = ReturnType<typeof useTranslations>;

/**
 * Bloque base/IVA/retención/total, idéntico en factura emitida y recibida.
 * Los valores por defecto los calcula cada diálogo (difieren en matices, p. ej.
 * la factura emitida precarga "base" con el total, no con la base) — este
 * componente solo aloja el layout y los `name` que leen las Server Actions.
 */
export function InvoiceFiscalFields({
  idPrefix,
  t,
  baseDefault,
  vatDefault,
  withholdingDefault,
  totalDefault,
}: {
  idPrefix: string;
  t: Translate;
  baseDefault: string;
  vatDefault: string;
  withholdingDefault: string;
  totalDefault: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-base`}>{t("invoiceBaseLabel")}</FieldLabel>
          <Input
            id={`${idPrefix}-base`}
            name="base"
            inputMode="decimal"
            defaultValue={baseDefault}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-vat`}>{t("invoiceVatLabel")}</FieldLabel>
          <Input
            id={`${idPrefix}-vat`}
            name="vat"
            inputMode="decimal"
            defaultValue={vatDefault}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-withholding`}>
            {t("invoiceWithholdingLabel")}
          </FieldLabel>
          <Input
            id={`${idPrefix}-withholding`}
            name="withholding"
            inputMode="decimal"
            defaultValue={withholdingDefault}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-total`}>{t("invoiceTotalLabel")}</FieldLabel>
          <Input
            id={`${idPrefix}-total`}
            name="total"
            inputMode="decimal"
            defaultValue={totalDefault}
            required
          />
        </Field>
      </div>
    </>
  );
}

/**
 * Adjuntar justificante + notas, idéntico en factura emitida y recibida.
 * `fileUrl`/`fileName` solo se pasan en modo edición con fichero ya guardado.
 */
export function InvoiceAttachmentFields({
  idPrefix,
  t,
  fileUrl,
  fileName,
  notes,
}: {
  idPrefix: string;
  t: Translate;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-file`}>{t("invoiceFileLabel")}</FieldLabel>
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <PaperclipIcon className="size-3.5" />
            {fileName ?? t("invoiceFileLabel")}
          </a>
        ) : null}
        <Input
          id={`${idPrefix}-file`}
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
        {fileUrl ? (
          <Field orientation="horizontal" className="mt-1">
            <Checkbox id={`${idPrefix}-remove-file`} name="removeFile" />
            <Label htmlFor={`${idPrefix}-remove-file`} className="font-normal">
              {t("removeFileLabel")}
            </Label>
          </Field>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-notes`}>{t("notesLabel")}</FieldLabel>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={2} defaultValue={notes ?? ""} />
      </Field>
    </>
  );
}
