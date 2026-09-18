"use client";

import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createPaymentMethod,
  updatePaymentMethod,
} from "@/app/[locale]/(app)/club/payment-methods-actions";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { formatCardNumberInput } from "@/lib/card";
import type { ClubPaymentMethodRow } from "@/lib/club-payment-methods";

type PaymentMethodDialogProps =
  | { mode: "create" }
  | { mode: "edit"; method: ClubPaymentMethodRow };

export function PaymentMethodDialog(props: PaymentMethodDialogProps) {
  const t = useTranslations("Club");
  const method = props.mode === "edit" ? props.method : null;
  const [open, setOpen] = useDialogParam(
    method ? `tarjeta:${method.id}` : "tarjeta-nueva",
  );
  const [state, action] = useActionState(
    method ? updatePaymentMethod : createPaymentMethod,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const [number, setNumber] = useState("");
  const [revealed, setRevealed] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {method ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editPaymentMethodSr", { label: method.label })}
          </span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createPaymentMethod")}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {method ? t("editPaymentMethodTitle") : t("newPaymentMethodTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={action}>
          {method ? <input type="hidden" name="id" value={method.id} /> : null}
          <FieldGroup>
            <FormError message={state.error} />
            <Field>
              <FieldLabel htmlFor="payment-label">
                {t("paymentMethodLabelLabel")}
              </FieldLabel>
              <Input
                id="payment-label"
                name="label"
                defaultValue={method?.label ?? ""}
                placeholder={t("paymentMethodLabelPlaceholder")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-number">
                {t("paymentMethodNumberLabel")}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="payment-number"
                  name="number"
                  type={revealed ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={method ? t("paymentMethodNumberKeep") : "4242 4242 4242 4242"}
                  required={!method}
                  value={number}
                  onChange={(e) => setNumber(formatCardNumberInput(e.target.value))}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={revealed ? t("hideCardNumber") : t("revealCardNumber")}
                    onClick={() => setRevealed((r) => !r)}
                  >
                    {revealed ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {method ? t("paymentMethodNumberKeepHint") : t("paymentMethodNoPinHint")}
              </FieldDescription>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="payment-expiry-month">
                  {t("paymentMethodExpiryMonthLabel")}
                </FieldLabel>
                <Input
                  id="payment-expiry-month"
                  name="expiryMonth"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={method?.expiryMonth ?? ""}
                  placeholder="09"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="payment-expiry-year">
                  {t("paymentMethodExpiryYearLabel")}
                </FieldLabel>
                <Input
                  id="payment-expiry-year"
                  name="expiryYear"
                  type="number"
                  min={2000}
                  max={2100}
                  defaultValue={method?.expiryYear ?? ""}
                  placeholder="2028"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="payment-holder">
                {t("paymentMethodHolderLabel")}
              </FieldLabel>
              <Input
                id="payment-holder"
                name="holderName"
                defaultValue={method?.holderName ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-notes">
                {t("paymentMethodNotesLabel")}
              </FieldLabel>
              <Input
                id="payment-notes"
                name="notes"
                defaultValue={method?.notes ?? ""}
              />
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {method ? t("saveChanges") : t("createPaymentMethod")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
