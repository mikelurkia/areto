"use client";

import { useActionState } from "react";
import { CheckCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { markRemittanceCollected } from "@/app/[locale]/(app)/cuotas/actions";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function MarkRemittanceCollectedButton({ remittanceId }: { remittanceId: string }) {
  const t = useTranslations("Cuotas");
  const [state, action] = useActionState(markRemittanceCollected, {});
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="remittanceId" value={remittanceId} />
      <SubmitButton variant="outline" size="sm">
        <CheckCheckIcon data-icon="inline-start" />
        {t("markRemittanceCollectedAction")}
      </SubmitButton>
    </form>
  );
}
