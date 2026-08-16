"use client";

import { useActionState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { renewSponsorshipTerm } from "@/app/[locale]/(app)/patrocinadores/actions";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";

export function RenewSponsorshipTermButton({ id }: { id: string }) {
  const t = useTranslations("Patrocinadores");
  const [state, action] = useActionState(renewSponsorshipTerm, {});
  useActionToast(state.message);

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="icon-sm">
        <RefreshCwIcon />
        <span className="sr-only">{t("renewTermSr")}</span>
      </Button>
    </form>
  );
}
