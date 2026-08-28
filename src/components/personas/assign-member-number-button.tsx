"use client";

import { useActionState } from "react";
import { HashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { assignNextMemberNumber } from "@/app/[locale]/(app)/personas/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function AssignMemberNumberButton({ personId }: { personId: string }) {
  const t = useTranslations("Personas");
  const [state, action] = useActionState(assignNextMemberNumber, {});
  useActionToast(state);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={personId} />
      <FormError message={state.error} />
      <SubmitButton variant="outline" size="sm">
        <HashIcon data-icon="inline-start" />
        {t("assignMemberNumberAction")}
      </SubmitButton>
    </form>
  );
}
