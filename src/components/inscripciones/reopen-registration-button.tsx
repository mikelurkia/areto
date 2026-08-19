"use client";

import { useActionState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { reopenRegistration } from "@/app/[locale]/(app)/inscripciones/actions";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function ReopenRegistrationButton({ registrationId }: { registrationId: string }) {
  const t = useTranslations("Inscripciones");
  const [state, action] = useActionState(reopenRegistration, {});
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={registrationId} />
      {state.error ? <p className="mb-2 text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton variant="outline" size="sm">
        <RotateCcwIcon data-icon="inline-start" />
        {t("reopenAction")}
      </SubmitButton>
    </form>
  );
}
