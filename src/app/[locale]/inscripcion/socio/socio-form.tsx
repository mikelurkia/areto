"use client";

import { useActionState, useState } from "react";
import { CheckCircle2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { submitMemberRegistration } from "@/app/[locale]/inscripcion/actions";
import { useIbanField } from "@/hooks/use-iban-field";
import { useRequiredCheckboxError } from "@/hooks/use-required-checkbox-error";
import { isMinor } from "@/lib/age";
import { Link } from "@/i18n/navigation";
import { Req } from "@/components/inscripciones/required-asterisk";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

let nextGuardianKey = 1;

export function SocioForm() {
  const t = useTranslations("Inscripciones");
  const [state, formAction] = useActionState(submitMemberRegistration, {});
  const [birthDate, setBirthDate] = useState("");
  const [guardianKeys, setGuardianKeys] = useState<number[]>([0]);
  const sepaConsent = useRequiredCheckboxError();
  const privacyConsent = useRequiredCheckboxError();
  // React resetea los campos no controlados de este formulario tras CUALQUIER
  // envío (éxito o error) — sin repoblar desde aquí, un solo campo inválido
  // borraría todo lo demás que ya se había escrito.
  const submitted = state.submitted;
  // El IBAN es controlado (a diferencia del resto de campos de texto) para
  // poder autoformatearlo; al ser estado de React ya sobrevive por sí solo a
  // ese reseteo, sin necesidad de repoblarse desde `submitted`.
  const iban = useIbanField("");

  const showGuardians = birthDate !== "" && isMinor(birthDate);

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
          {t("memberSection")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="firstName">{t("firstNameLabel")}</FieldLabel>
            <Input id="firstName" name="firstName" required defaultValue={submitted?.firstName ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">{t("lastNameLabel")}</FieldLabel>
            <Input id="lastName" name="lastName" required defaultValue={submitted?.lastName ?? ""} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="birthDate">{t("birthDateLabel")}</FieldLabel>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="nationalId">{t("nationalIdLabel")}</FieldLabel>
            <Input
              id="nationalId"
              name="nationalId"
              placeholder={t("nationalIdPlaceholder")}
              defaultValue={submitted?.nationalId ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="address">{t("addressLabel")}</FieldLabel>
            <Input id="address" name="address" required defaultValue={submitted?.address ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">{t("cityLabel")}</FieldLabel>
            <Input id="city" name="city" required defaultValue={submitted?.city ?? ""} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">{t("phoneLabel")}</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              defaultValue={submitted?.phone ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={submitted?.email ?? ""}
            />
          </Field>
        </div>
      </FieldGroup>

      {showGuardians ? (
        <FieldGroup>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t("guardiansSection")}
            </h2>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              onClick={() => setGuardianKeys((prev) => [...prev, nextGuardianKey++])}
            >
              <PlusIcon className="size-4" />
              {t("addGuardianAction")}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{t("guardiansHint")}</p>
          <p className="text-sm text-muted-foreground">{t("guardiansPayerHint")}</p>
          {guardianKeys.map((key, i) => {
            const existing = submitted?.guardians[i];
            return (
              <div key={key} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t("guardianLabel")} {i + 1}
                  </span>
                  {guardianKeys.length > 1 ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setGuardianKeys((prev) => prev.filter((k) => k !== key))}
                      aria-label={t("removeGuardianSr", { index: i + 1 })}
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-firstName`}>
                      {t("firstNameLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-firstName`}
                      name="guardianFirstName"
                      required={showGuardians}
                      defaultValue={existing?.firstName ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-lastName`}>
                      {t("lastNameLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-lastName`}
                      name="guardianLastName"
                      required={showGuardians}
                      defaultValue={existing?.lastName ?? ""}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-birthDate`}>
                      {t("birthDateLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-birthDate`}
                      name="guardianBirthDate"
                      type="date"
                      required={showGuardians}
                      defaultValue={existing?.birthDate ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-nationalId`}>
                      {t("nationalIdLabel")}
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-nationalId`}
                      name="guardianNationalId"
                      defaultValue={existing?.nationalId ?? ""}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-address`}>
                    {t("addressLabel")}
                    <Req />
                  </FieldLabel>
                  <Input
                    id={`guardian-${key}-address`}
                    name="guardianAddress"
                    required={showGuardians}
                    defaultValue={existing?.address ?? ""}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-phone`}>
                      {t("phoneLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-phone`}
                      name="guardianPhone"
                      type="tel"
                      required={showGuardians}
                      defaultValue={existing?.phone ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-email`}>
                      {t("emailLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-email`}
                      name="guardianEmail"
                      type="email"
                      required={showGuardians}
                      defaultValue={existing?.email ?? ""}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </FieldGroup>
      ) : null}

      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("paymentSection")}
        </h2>
        <Field>
          <FieldLabel htmlFor="iban">{t("ibanLabel")}</FieldLabel>
          <Input
            id="iban"
            name="iban"
            placeholder="ES00 0000 0000 00 0000000000"
            required
            {...iban}
          />
          <p className="text-xs text-muted-foreground">
            {t(showGuardians ? "memberIbanHintMinor" : "memberIbanHint")}
          </p>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="sepaConsent"
            name="sepaConsent"
            required
            defaultChecked={submitted?.sepaConsent}
            inputRef={sepaConsent.inputRef}
            aria-invalid={sepaConsent.error ? true : undefined}
            aria-describedby={sepaConsent.error ? "sepaConsent-error" : undefined}
            onCheckedChange={(checked) => {
              if (checked) sepaConsent.clear();
            }}
          />
          <Label htmlFor="sepaConsent" className="font-normal">
            {t("sepaConsentLabelMember")}
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
        <Field orientation="horizontal">
          <Checkbox
            id="privacyConsent"
            name="privacyConsent"
            required
            defaultChecked={submitted?.privacyConsent}
            inputRef={privacyConsent.inputRef}
            aria-invalid={privacyConsent.error ? true : undefined}
            aria-describedby={privacyConsent.error ? "privacyConsent-error" : undefined}
            onCheckedChange={(checked) => {
              if (checked) privacyConsent.clear();
            }}
          />
          <Label htmlFor="privacyConsent" className="font-normal">
            {t("privacyConsentLabel")}
            <Req />
          </Label>
        </Field>
        <Link
          href="/inscripcion/privacidad"
          target="_blank"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          {t("privacyConsentMoreInfo")}
        </Link>
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
