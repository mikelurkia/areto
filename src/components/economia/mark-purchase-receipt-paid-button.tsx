"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

type MarkAction = (prev: EconomiaState, formData: FormData) => Promise<EconomiaState>;

export function MarkPurchaseReceiptPaidButton({
  id,
  paid,
  markAction,
  unmarkAction,
}: {
  id: string;
  paid: boolean;
  markAction: MarkAction;
  unmarkAction: MarkAction;
}) {
  const t = useTranslations("Economia");
  const [state, action] = useActionState(paid ? unmarkAction : markAction, {});
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant={paid ? "outline" : "default"} size="sm">
        {paid ? t("ticketUnmarkPaidButton") : t("ticketMarkPaidButton")}
      </SubmitButton>
    </form>
  );
}
