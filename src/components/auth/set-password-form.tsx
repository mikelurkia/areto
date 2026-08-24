"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { setPassword, type AuthState } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: AuthState = {};

/** Fija la contraseña tras aceptar una invitación o pedir una recuperación. */
export function SetPasswordForm() {
  const t = useTranslations("Login");
  const [state, action] = useActionState(setPassword, initialState);

  return (
    <form action={action}>
      <FieldGroup>
        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor="new-password">{t("newPassword")}</FieldLabel>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={state.error ? true : undefined}
          />
          <FieldDescription>{t("minChars")}</FieldDescription>
        </Field>
        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor="confirm-password">
            {t("confirmPassword")}
          </FieldLabel>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={state.error ? true : undefined}
          />
          {state.error ? (
            <FieldDescription className="text-destructive">
              {state.error}
            </FieldDescription>
          ) : null}
        </Field>
        <SubmitButton className="w-full">{t("savePassword")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
