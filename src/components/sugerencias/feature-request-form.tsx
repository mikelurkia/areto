"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";

import { createFeatureRequest } from "@/app/[locale]/(app)/sugerencias/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";

export function FeatureRequestForm() {
  const t = useTranslations("Sugerencias");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createFeatureRequest, {});
  useActionToast(state);
  useActionResult(state, (result) => {
    if (result.message) formRef.current?.reset();
  });

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="feature-request-title">{t("titleLabel")}</Label>
        <Input
          id="feature-request-title"
          name="title"
          placeholder={t("titlePlaceholder")}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="feature-request-description">{t("descriptionLabel")}</Label>
        <Textarea
          id="feature-request-description"
          name="description"
          placeholder={t("descriptionPlaceholder")}
          required
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="self-end">{t("submitAction")}</SubmitButton>
    </form>
  );
}
