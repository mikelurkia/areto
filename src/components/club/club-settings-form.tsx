"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updateClubSettings, type ClubState } from "@/app/[locale]/(app)/club/actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

type ClubSettingsValues = {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  federationCode: string | null;
};

export function ClubSettingsForm({ settings }: { settings: ClubSettingsValues | null }) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(updateClubSettings, initialState);
  useActionToast(state);

  // `key` fuerza el remount de los inputs no controlados cuando cambian los
  // datos guardados, para que el defaultValue se refresque tras guardar.
  const revision = JSON.stringify(settings);

  return (
    <form action={action} key={revision}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="club-legalName">{t("clubLegalNameLabel")}</FieldLabel>
          <Input
            id="club-legalName"
            name="legalName"
            defaultValue={settings?.legalName ?? ""}
            placeholder={t("clubLegalNamePlaceholder")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="club-taxId">{t("clubTaxIdLabel")}</FieldLabel>
            <Input id="club-taxId" name="taxId" defaultValue={settings?.taxId ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="club-iban">{t("clubIbanLabel")}</FieldLabel>
            <Input id="club-iban" name="iban" defaultValue={settings?.iban ?? ""} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="club-address">{t("clubAddressLabel")}</FieldLabel>
          <Input
            id="club-address"
            name="address"
            defaultValue={settings?.address ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="club-email">{t("clubEmailLabel")}</FieldLabel>
            <Input
              id="club-email"
              name="email"
              type="email"
              defaultValue={settings?.email ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="club-phone">{t("clubPhoneLabel")}</FieldLabel>
            <Input id="club-phone" name="phone" defaultValue={settings?.phone ?? ""} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="club-federationCode">
            {t("clubFederationCodeLabel")}
          </FieldLabel>
          <Input
            id="club-federationCode"
            name="federationCode"
            defaultValue={settings?.federationCode ?? "2022"}
          />
        </Field>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
