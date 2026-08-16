"use client";

import { useActionState } from "react";
import { HashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { assignNextMemberNumber } from "@/app/[locale]/(app)/personas/actions";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function AssignMemberNumberButton({ personId }: { personId: string }) {
  const t = useTranslations("Personas");
  const [state, action] = useActionState(assignNextMemberNumber, {});
  useActionToast(state.message);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={personId} />
      {state.error ? (
        <p className="mb-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      <SubmitButton variant="outline" size="sm">
        <HashIcon data-icon="inline-start" />
        {t("assignMemberNumberAction")}
      </SubmitButton>
    </form>
  );
}
