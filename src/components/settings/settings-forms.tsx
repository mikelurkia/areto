"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  deleteAccount,
  updateClubSettings,
  updateEmail,
  updateProfile,
  updatePassword,
  type SettingsState,
} from "@/app/[locale]/(app)/ajustes/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: SettingsState = {};

function FormError({ state }: { state: SettingsState }) {
  if (!state.error) return null;
  return <p className="text-sm text-destructive">{state.error}</p>;
}

export function ProfileForm({ fullName }: { fullName: string | null }) {
  const t = useTranslations("Settings");
  const [state, action] = useActionState(updateProfile, initialState);
  useActionToast(state.message);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fullName">{t("fullNameLabel")}</FieldLabel>
          <Input
            key={fullName ?? ""}
            id="fullName"
            name="fullName"
            defaultValue={fullName ?? ""}
            placeholder={t("fullNamePlaceholder")}
          />
        </Field>
        <FormError state={state} />
        <SubmitButton className="self-start">{t("saveName")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}

type ClubSettingsValues = {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
};

export function ClubSettingsForm({ settings }: { settings: ClubSettingsValues | null }) {
  const t = useTranslations("Settings");
  const [state, action] = useActionState(updateClubSettings, initialState);
  useActionToast(state.message);

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
        <FormError state={state} />
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const t = useTranslations("Settings");
  const [state, action] = useActionState(updateEmail, initialState);
  useActionToast(state.message);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input
            key={email}
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            required
          />
        </Field>
        <FormError state={state} />
        <SubmitButton className="self-start">{t("updateEmail")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("Settings");
  const [state, action] = useActionState(updatePassword, initialState);
  useActionToast(state.message);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">{t("newPasswordLabel")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">
            {t("confirmPasswordLabel")}
          </FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <FormError state={state} />
        <SubmitButton className="self-start">
          {t("updatePassword")}
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

export function DangerZone({ email }: { email: string }) {
  const t = useTranslations("Settings");
  const [state, action] = useActionState(deleteAccount, initialState);
  const [confirmValue, setConfirmValue] = useState("");
  const matches = confirmValue.trim() === email;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>
        {t("deleteAccount")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteConfirmDescription", { email })}
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="confirmEmail">
                {t("deleteConfirmLabel")}
              </FieldLabel>
              <Input
                id="confirmEmail"
                name="confirmEmail"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <FormError state={state} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton variant="destructive" disabled={!matches}>
                {t("deleteConfirmButton")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
