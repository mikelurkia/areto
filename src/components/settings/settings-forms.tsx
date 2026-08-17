"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  deleteAccount,
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
