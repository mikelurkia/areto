"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  updateClubMedicalSettings,
  type ClubState,
} from "@/app/[locale]/(app)/club/actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

export function ClubMedicalForm({
  federationDelegation,
}: {
  federationDelegation: string | null;
}) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(updateClubMedicalSettings, initialState);
  useActionToast(state);

  return (
    <form action={action} key={federationDelegation ?? ""}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="club-federationDelegation">
            {t("clubFederationDelegationLabel")}
          </FieldLabel>
          <Input
            id="club-federationDelegation"
            name="federationDelegation"
            defaultValue={federationDelegation ?? ""}
            placeholder={t("clubFederationDelegationPlaceholder")}
          />
        </Field>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
