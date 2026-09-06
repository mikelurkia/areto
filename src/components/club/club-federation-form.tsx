"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  updateClubFederationSettings,
  type ClubState,
} from "@/app/[locale]/(app)/club/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

export function ClubFederationForm({
  federationCode,
}: {
  federationCode: string | null;
}) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(updateClubFederationSettings, initialState);
  useActionToast(state);

  return (
    <form action={action} key={federationCode ?? ""}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="club-federationCode">
            {t("clubFederationCodeLabel")}
          </FieldLabel>
          <Input
            id="club-federationCode"
            name="federationCode"
            defaultValue={federationCode ?? "2022"}
          />
        </Field>
        <FormError message={state.error} />
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
