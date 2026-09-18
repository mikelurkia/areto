"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, CreditCardIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  deletePaymentMethod,
  revealCardNumber,
} from "@/app/[locale]/(app)/club/payment-methods-actions";
import { PaymentMethodDialog } from "@/components/club/payment-method-dialog";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CARD_EXPIRY_TONE, cardExpiryStatus, groupCardNumber } from "@/lib/card";
import type { ClubPaymentMethodRow } from "@/lib/club-payment-methods";

function PaymentMethodCard({
  method,
  canManage,
}: {
  method: ClubPaymentMethodRow;
  canManage: boolean;
}) {
  const t = useTranslations("Club");
  // El número completo solo vive aquí mientras está revelado; ocultarlo lo
  // borra del estado. Nunca llega en las props.
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const expiry = cardExpiryStatus(method.expiryMonth, method.expiryYear);
  const expiryLabel = `${String(method.expiryMonth).padStart(2, "0")}/${method.expiryYear}`;

  async function fetchNumber(): Promise<string | null> {
    if (number) return number;
    const result = await revealCardNumber(method.id);
    if ("error" in result) {
      setError(result.error);
      return null;
    }
    setError(null);
    return result.number;
  }

  return (
    <Card size="sm" className="px-(--card-spacing)">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="size-4 text-muted-foreground" />
          <h3 className="font-medium">{method.label}</h3>
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center">
            <PaymentMethodDialog mode="edit" method={method} />
            <DeleteEntityDialog
              id={method.id}
              namespace="Club"
              entityKey="PaymentMethod"
              paramKey="borrar-tarjeta"
              values={{ label: method.label }}
              deleteAction={deletePaymentMethod}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">
          {number ? groupCardNumber(number) : `•••• •••• •••• ${method.last4}`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={number ? t("hideCardNumber") : t("revealCardNumber")}
          onClick={async () => {
            if (number) {
              setNumber(null);
              return;
            }
            setNumber(await fetchNumber());
          }}
        >
          {number ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={t("copyCardNumber")}
          onClick={async () => {
            const value = await fetchNumber();
            if (!value) return;
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              // El navegador puede bloquear el portapapeles; no es crítico.
            }
          }}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
        <StatusBadge
          tone={CARD_EXPIRY_TONE[expiry]}
          label={
            expiry === "ok"
              ? expiryLabel
              : `${expiryLabel} · ${expiry === "expired" ? t("cardExpired") : t("cardExpiring")}`
          }
        />
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {method.holderName || method.notes ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {[method.holderName, method.notes].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </Card>
  );
}

export function PaymentMethodsList({
  methods,
  canManage,
}: {
  methods: ClubPaymentMethodRow[];
  canManage: boolean;
}) {
  const t = useTranslations("Club");

  if (methods.length === 0) {
    return (
      <SectionPlaceholder size="compact" title={t("paymentMethodsEmpty")} />
    );
  }

  return (
    <div className="grid gap-3">
      {methods.map((method) => (
        <PaymentMethodCard key={method.id} method={method} canManage={canManage} />
      ))}
    </div>
  );
}
