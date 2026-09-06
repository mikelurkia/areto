"use client";

import { useActionState, useState } from "react";
import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { formatCents } from "@/lib/money";

type InvoiceOption = { id: string; number: string; totalCents: number; label: string };

type LinkAction = (prev: EconomiaState, formData: FormData) => Promise<EconomiaState>;

export function LinkInvoiceDialog({
  movementId,
  amountCents,
  receivedInvoices,
  issuedInvoices,
  linkReceivedInvoiceAction,
  linkIssuedInvoiceAction,
  locale,
}: {
  movementId: string;
  amountCents: number;
  receivedInvoices: InvoiceOption[];
  issuedInvoices: InvoiceOption[];
  linkReceivedInvoiceAction: LinkAction;
  linkIssuedInvoiceAction: LinkAction;
  locale: string;
}) {
  const t = useTranslations("Economia");
  const [open, setOpen] = useDialogParam(`vincular:${movementId}`);
  // Un apunte negativo casa con una factura recibida (gasto); uno positivo,
  // con una emitida (cobro) — igual que el filtro de signo de los candidatos
  // en la ficha de factura.
  const [kind, setKind] = useState<"received" | "issued">(
    amountCents < 0 ? "received" : "issued",
  );
  const options = kind === "received" ? receivedInvoices : issuedInvoices;
  const [invoiceId, setInvoiceId] = useState(options[0]?.id ?? "");

  const [receivedState, receivedAction] = useActionState(linkReceivedInvoiceAction, {});
  const [issuedState, issuedAction] = useActionState(linkIssuedInvoiceAction, {});
  const state = kind === "received" ? receivedState : issuedState;
  useActionToast(receivedState);
  useActionToast(issuedState);
  useCloseOnActionSuccess(receivedState, setOpen);
  useCloseOnActionSuccess(issuedState, setOpen);

  const suggestedAmount = String(Math.abs(amountCents) / 100);

  function changeKind(value: "received" | "issued") {
    setKind(value);
    const next = value === "received" ? receivedInvoices : issuedInvoices;
    setInvoiceId(next[0]?.id ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <LinkIcon />
        <span className="sr-only">{t("linkInvoiceFromMovementSr")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("linkInvoiceFromMovementTitle")}</DialogTitle>
        </DialogHeader>
        <form action={kind === "received" ? receivedAction : issuedAction}>
          <input type="hidden" name="movementId" value={movementId} />
          <input
            type="hidden"
            name={kind === "received" ? "receivedInvoiceId" : "issuedInvoiceId"}
            value={invoiceId}
          />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="link-invoice-kind">{t("invoiceKindLabel")}</FieldLabel>
              <Select value={kind} onValueChange={(v) => changeKind(v as "received" | "issued")}>
                <SelectTrigger id="link-invoice-kind" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === "received" ? t("receivedInvoiceKind") : t("issuedInvoiceKind")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">{t("receivedInvoiceKind")}</SelectItem>
                  <SelectItem value="issued">{t("issuedInvoiceKind")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-invoice-select">{t("invoiceLabel")}</FieldLabel>
              <Select value={invoiceId} onValueChange={(v) => setInvoiceId(v ?? "")}>
                <SelectTrigger id="link-invoice-select" className="w-full">
                  <SelectValue>
                    {(value: string) => options.find((o) => o.id === value)?.number ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.number} · {o.label} ({formatCents(o.totalCents, locale)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-invoice-amount">{t("amountLabel")}</FieldLabel>
              <Input
                id="link-invoice-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={suggestedAmount}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="link-invoice-file">{t("receiptFileLabel")}</FieldLabel>
              <Input id="link-invoice-file" name="file" type="file" />
            </Field>
            <SubmitButton disabled={!invoiceId}>{t("linkAction")}</SubmitButton>
          </FieldGroup>
          <FormError message={state.error} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
