"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { markSponsorPaymentPaid } from "@/app/[locale]/(app)/patrocinadores/actions";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";

export function MarkPaymentPaidButton({ id }: { id: string }) {
  const t = useTranslations("Patrocinadores");
  const [state, action] = useActionState(markSponsorPaymentPaid, {});
  useActionToast(state.message);

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="icon-sm" className="text-primary">
        <CheckIcon />
        <span className="sr-only">{t("markPaidSr")}</span>
      </Button>
    </form>
  );
}
