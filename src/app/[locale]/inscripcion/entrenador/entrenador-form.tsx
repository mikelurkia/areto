"use client";

import { useActionState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { submitCoachRegistration } from "@/app/[locale]/inscripcion/actions";
import { useRequiredCheckboxError } from "@/hooks/use-required-checkbox-error";
import { Link } from "@/i18n/navigation";
import { Req } from "@/components/inscripciones/required-asterisk";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EntrenadorForm() {
  const t = useTranslations("Inscripciones");
  const [state, formAction] = useActionState(submitCoachRegistration, {});
  const sepaConsent = useRequiredCheckboxError();
  const privacyConsent = useRequiredCheckboxError();

  if (state.success) {
    const code = state.registrationId?.slice(0, 8).toUpperCase();
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <CheckCircle2Icon className="size-8 text-primary" />
        <h2 className="text-lg font-semibold">{t("successTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("successDescription")}</p>
        {code ? (
          <div className="mt-2 flex flex-col items-center gap-1">
            <p className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm font-medium">
              {t("registrationCodeLabel", { code })}
            </p>
            <p className="max-w-md text-xs text-muted-foreground">{t("registrationCodeHint")}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("coachSection")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="firstName">{t("firstNameLabel")}</FieldLabel>
            <Input id="firstName" name="firstName" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">{t("lastNameLabel")}</FieldLabel>
            <Input id="lastName" name="lastName" required />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="birthDate">{t("birthDateLabel")}</FieldLabel>
            <Input id="birthDate" name="birthDate" type="date" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="nationalId">{t("nationalIdLabel")}</FieldLabel>
            <Input id="nationalId" name="nationalId" placeholder={t("nationalIdPlaceholder")} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="address">{t("addressLabel")}</FieldLabel>
            <Input id="address" name="address" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">{t("cityLabel")}</FieldLabel>
            <Input id="city" name="city" required />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">{t("phoneLabel")}</FieldLabel>
            <Input id="phone" name="phone" type="tel" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
            <Input id="email" name="email" type="email" required />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("paymentSection")}
        </h2>
        <Field>
          <FieldLabel htmlFor="iban">{t("ibanLabel")}</FieldLabel>
          <Input id="iban" name="iban" placeholder="ES00 0000 0000 0000 0000 0000" required />
          <p className="text-xs text-muted-foreground">{t("coachIbanHint")}</p>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="sepaConsent"
            name="sepaConsent"
            required
            inputRef={sepaConsent.inputRef}
            aria-invalid={sepaConsent.error ? true : undefined}
            aria-describedby={sepaConsent.error ? "sepaConsent-error" : undefined}
            onCheckedChange={(checked) => {
              if (checked) sepaConsent.clear();
            }}
          />
          <Label htmlFor="sepaConsent" className="font-normal">
            {t("sepaConsentLabel")}
            <Req />
          </Label>
        </Field>
        <Link
          href="/inscripcion/jugador/sepa"
          target="_blank"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          {t("sepaConsentMoreInfo")}
        </Link>
        {sepaConsent.error ? (
          <p id="sepaConsent-error" className="text-sm text-destructive">
            {t("sepaConsentRequired")}
          </p>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("documentsSection")}
        </h2>
        <Field>
          <FieldLabel htmlFor="photo">{t("photoLabel")}</FieldLabel>
          <Input
            id="photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="idFront">{t("idFrontLabel")}</FieldLabel>
            <Input
              id="idFront"
              name="idFront"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="idBack">{t("idBackLabel")}</FieldLabel>
            <Input
              id="idBack"
              name="idBack"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox id="photoConsent" name="photoConsent" />
          <Label htmlFor="photoConsent" className="font-normal">
            {t("imageConsentLabel")}
          </Label>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="privacyConsent"
            name="privacyConsent"
            required
            inputRef={privacyConsent.inputRef}
            aria-invalid={privacyConsent.error ? true : undefined}
            aria-describedby={privacyConsent.error ? "privacyConsent-error" : undefined}
            onCheckedChange={(checked) => {
              if (checked) privacyConsent.clear();
            }}
          />
          <Label htmlFor="privacyConsent" className="font-normal">
            {t("privacyNoticePrefix")}{" "}
            <Link
              href="/inscripcion/privacidad"
              target="_blank"
              className="underline hover:text-foreground"
            >
              {t("privacyNoticeLinkText")}
            </Link>
            <Req />
          </Label>
        </Field>
        {privacyConsent.error ? (
          <p id="privacyConsent-error" className="text-sm text-destructive">
            {t("privacyConsentRequired")}
          </p>
        ) : null}
      </FieldGroup>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton size="lg">{t("submitAction")}</SubmitButton>
    </form>
  );
}
