"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updateClubSignatories, type ClubState } from "@/app/[locale]/(app)/club/actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

type ClubSignatoriesValues = {
  signatoryName: string | null;
  signatoryNationalId: string | null;
};

export function ClubSignatoriesForm({
  settings,
}: {
  settings: ClubSignatoriesValues | null;
}) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(updateClubSignatories, initialState);
  useActionToast(state);

  const revision = JSON.stringify(settings);

  return (
    <form action={action} key={revision}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="club-signatoryName">
              {t("clubSignatoryNameLabel")}
            </FieldLabel>
            <Input
              id="club-signatoryName"
              name="signatoryName"
              defaultValue={settings?.signatoryName ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="club-signatoryNationalId">
              {t("clubSignatoryNationalIdLabel")}
            </FieldLabel>
            <Input
              id="club-signatoryNationalId"
              name="signatoryNationalId"
              defaultValue={settings?.signatoryNationalId ?? ""}
            />
          </Field>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
