"use client";

import { useActionState, useEffect } from "react";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { issueSponsorInvoice } from "@/app/[locale]/(app)/patrocinadores/actions";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";

export function IssueInvoiceButton({ id }: { id: string }) {
  const t = useTranslations("Patrocinadores");
  const [state, action] = useActionState(issueSponsorInvoice, {});
  useActionToast(state.message);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="icon-sm">
        <FileTextIcon />
        <span className="sr-only">{t("issueInvoiceSr")}</span>
      </Button>
    </form>
  );
}
