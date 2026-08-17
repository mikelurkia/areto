"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addSponsorPayment,
  updateSponsorPayment,
} from "@/app/[locale]/(app)/patrocinadores/actions";
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
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

const STATUSES = ["pending", "paid", "overdue", "waived"] as const;

type TermOption = { id: string; label: string };

type SponsorPayment = {
  id: string;
  termId: string;
  year: number | null;
  amountCents: number;
  status: string;
  dueDate: string | null;
  paidOn: string | null;
  method: string | null;
  invoiceNumber: string | null;
  invoicedOn: string | null;
  notes: string | null;
};

type SponsorPaymentDialogProps =
  | {
      mode: "create";
      termOptions: TermOption[];
      defaultTermId: string;
      defaultAmountCents?: number | null;
    }
  | { mode: "edit"; payment: SponsorPayment };

export function SponsorPaymentDialog(props: SponsorPaymentDialogProps) {
  const t = useTranslations("Patrocinadores");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `anualidad-nueva:${props.defaultTermId}`
      : `anualidad:${props.payment.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? addSponsorPayment : updateSponsorPayment,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const payment = useFrozenWhileOpen(open, props.mode === "edit" ? props.payment : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button size="sm" />}>
          <PlusIcon data-icon="inline-start" />
          {t("addPaymentAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editPaymentSr")}</span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newPaymentTitle") : t("editPaymentTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={payment!.id} />
          ) : null}
          <FieldGroup>
            {props.mode === "create" ? (
              <Field>
                <FieldLabel htmlFor="payment-term">{t("paymentTermLabel")}</FieldLabel>
                <Select name="termId" defaultValue={props.defaultTermId}>
                  <SelectTrigger id="payment-term" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        props.termOptions.find((option) => option.id === value)?.label ?? value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {props.termOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="termId" value={payment!.termId} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="payment-year">{t("seasonYearLabel")}</FieldLabel>
                <Input
                  id="payment-year"
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  placeholder="2026"
                  defaultValue={payment?.year != null ? String(payment.year) : ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="payment-amount">{t("amountLabel")}</FieldLabel>
                <Input
                  id="payment-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="1500"
                  defaultValue={
                    payment?.amountCents != null
                      ? (payment.amountCents / 100).toString()
                      : props.mode === "create" && props.defaultAmountCents != null
                        ? (props.defaultAmountCents / 100).toString()
                        : ""
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="payment-status">{t("paymentStatusLabel")}</FieldLabel>
                <Select name="status" defaultValue={payment?.status ?? "pending"}>
                  <SelectTrigger id="payment-status" className="w-full">
                    <SelectValue>
                      {(value: string) => t(`paymentStatus.${value}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`paymentStatus.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="payment-due-date">{t("dueDateLabel")}</FieldLabel>
                <Input
                  id="payment-due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={payment?.dueDate ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="payment-paid-on">{t("paidOnLabel")}</FieldLabel>
                <Input
                  id="payment-paid-on"
                  name="paidOn"
                  type="date"
                  defaultValue={payment?.paidOn ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="payment-method">{t("methodLabel")}</FieldLabel>
              <Input
                id="payment-method"
                name="method"
                defaultValue={payment?.method ?? ""}
                placeholder={t("methodPlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="payment-notes"
                name="notes"
                defaultValue={payment?.notes ?? ""}
              />
            </Field>
          </FieldGroup>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>
              {props.mode === "create" ? t("addPaymentAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
