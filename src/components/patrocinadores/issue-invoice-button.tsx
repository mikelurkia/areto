"use client";

import { useActionState } from "react";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { issueSponsorInvoice } from "@/app/[locale]/(app)/patrocinadores/actions";
import { SubmitIconButton } from "@/components/submit-icon-button";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";

export function IssueInvoiceButton({ id }: { id: string }) {
  const t = useTranslations("Patrocinadores");
  const [state, action] = useActionState(issueSponsorInvoice, {});
  useActionToast(state);
  useActionResult(state, (result) => {
    if (result.error) toast.error(result.error);
  });

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <SubmitIconButton label={t("issueInvoiceSr")}>
        <FileTextIcon />
      </SubmitIconButton>
    </form>
  );
}
