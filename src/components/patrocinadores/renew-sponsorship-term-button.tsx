"use client";

import { useActionState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { renewSponsorshipTerm } from "@/app/[locale]/(app)/patrocinadores/actions";
import { SubmitIconButton } from "@/components/submit-icon-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function RenewSponsorshipTermButton({ id }: { id: string }) {
  const t = useTranslations("Patrocinadores");
  const [state, action] = useActionState(renewSponsorshipTerm, {});
  useActionToast(state);

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <SubmitIconButton label={t("renewTermSr")}>
        <RefreshCwIcon />
      </SubmitIconButton>
    </form>
  );
}
