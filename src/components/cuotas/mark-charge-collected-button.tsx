"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateChargeStatus } from "@/app/[locale]/(app)/cuotas/actions";
import { SubmitIconButton } from "@/components/submit-icon-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function MarkChargeCollectedButton({ id }: { id: string }) {
  const t = useTranslations("Cuotas");
  const [state, action] = useActionState(updateChargeStatus, {});
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="collected" />
      <SubmitIconButton label={t("markCollectedSr")} className="text-primary">
        <CheckIcon />
      </SubmitIconButton>
    </form>
  );
}
