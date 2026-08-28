"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updateClubIdentity, type ClubState } from "@/app/[locale]/(app)/club/actions";
import { useIbanField } from "@/hooks/use-iban-field";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

type ClubIdentityValues = {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
};

export function ClubIdentityForm({ settings }: { settings: ClubIdentityValues | null }) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(updateClubIdentity, initialState);
  useActionToast(state);

  // `key` fuerza el remount de los inputs no controlados cuando cambian los
  // datos guardados, para que el defaultValue se refresque tras guardar (y,
  // de paso, el estado inicial de `useIbanField` de abajo).
  const revision = JSON.stringify(settings);
  const iban = useIbanField(settings?.iban ?? "");

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
            <Input id="club-iban" name="iban" {...iban} />
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
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
