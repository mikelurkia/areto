"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  updateRegistrationAvailability,
  type ClubState,
} from "@/app/[locale]/(app)/club/actions";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

export function RegistrationAvailabilityForm({
  playerRegistrationOpen,
  memberRegistrationOpen,
}: {
  playerRegistrationOpen: boolean;
  memberRegistrationOpen: boolean;
}) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(updateRegistrationAvailability, initialState);
  useActionToast(state);

  return (
    <form action={action} key={`${playerRegistrationOpen}-${memberRegistrationOpen}`}>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="registration-player-open"
            name="playerRegistrationOpen"
            defaultChecked={playerRegistrationOpen}
          />
          <Label htmlFor="registration-player-open" className="font-normal">
            {t("playerRegistrationOpenLabel")}
          </Label>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="registration-member-open"
            name="memberRegistrationOpen"
            defaultChecked={memberRegistrationOpen}
          />
          <Label htmlFor="registration-member-open" className="font-normal">
            {t("memberRegistrationOpenLabel")}
          </Label>
        </Field>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveRegistrationSettings")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
