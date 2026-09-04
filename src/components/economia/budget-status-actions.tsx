"use client";

import { useActionState } from "react";
import { CheckIcon, LockOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { setBudgetStatus } from "@/app/[locale]/(app)/economia/presupuesto/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { type Ledger } from "@/lib/economia";

/**
 * Aprobar congela el presupuesto y reabrir lo devuelve a borrador. Sin diálogo
 * de confirmación: las dos son reversibles y quedan en `audit_log`.
 */
export function BudgetStatusActions({
  ledger,
  seasonId,
  approved,
}: {
  ledger: Ledger;
  seasonId: string;
  approved: boolean;
}) {
  const t = useTranslations("Economia");
  const [state, formAction] = useActionState(setBudgetStatus, {});
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="ledger" value={ledger} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="status" value={approved ? "draft" : "approved"} />
      <SubmitButton variant="outline" size="sm">
        {approved ? (
          <LockOpenIcon data-icon="inline-start" />
        ) : (
          <CheckIcon data-icon="inline-start" />
        )}
        {approved ? t("reopenBudgetAction") : t("approveBudgetAction")}
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
