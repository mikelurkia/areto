"use client";

import { useActionState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { reopenRegistration } from "@/app/[locale]/(app)/inscripciones/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function ReopenRegistrationButton({ registrationId }: { registrationId: string }) {
  const t = useTranslations("Inscripciones");
  const [state, action] = useActionState(reopenRegistration, {});
  useActionToast(state);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={registrationId} />
      <FormError message={state.error} />
      <SubmitButton variant="outline" size="sm">
        <RotateCcwIcon data-icon="inline-start" />
        {t("reopenAction")}
      </SubmitButton>
    </form>
  );
}
