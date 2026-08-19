"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { submitPlayerRegistration } from "@/app/[locale]/inscripcion/actions";
import { useRequiredCheckboxError } from "@/hooks/use-required-checkbox-error";
import { isMinor } from "@/lib/age";
import { Link } from "@/i18n/navigation";
import { Req } from "@/components/inscripciones/required-asterisk";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

let nextGuardianKey = 1;

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE_SIZES = Array.from({ length: 50 - 28 + 1 }, (_, i) => String(28 + i));

/** Campo de foto con miniatura tras seleccionar (revocada al cambiar/desmontar,
 * para no acumular URLs de objeto) y el límite de tamaño siempre visible. */
function PhotoField({
  id,
  name,
  label,
  hint,
  error,
}: {
  id: string;
  name: string;
  label: ReactNode;
  hint: string;
  error?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
        ) : null}
        <Input
          id={id}
          name={name}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          aria-invalid={error ? true : undefined}
          className="flex-1"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return file ? URL.createObjectURL(file) : null;
            });
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function JugadorForm() {
  const t = useTranslations("Inscripciones");
  const [state, formAction] = useActionState(submitPlayerRegistration, {});
  const [birthDate, setBirthDate] = useState("");
  const [guardianKeys, setGuardianKeys] = useState<number[]>([0]);
  const [installments, setInstallments] = useState("1");
  const [shirtSize, setShirtSize] = useState("");
  const [pantsSize, setPantsSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const sepaConsent = useRequiredCheckboxError();
  const termsConsent = useRequiredCheckboxError();
  const privacyConsent = useRequiredCheckboxError();
  const fieldErrors = state.fieldErrors ?? {};

  const showGuardians = !birthDate || isMinor(birthDate);

  useEffect(() => {
    if (!state.error) return;
    const firstInvalid = document.querySelector('[aria-invalid="true"]');
    if (firstInvalid instanceof HTMLElement) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus();
    }
  }, [state]);

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
      <p className="text-xs text-muted-foreground">{t("requiredFieldsLegend")}</p>

      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("playerSection")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={fieldErrors.firstName ? true : undefined}>
            <FieldLabel htmlFor="firstName">
              {t("firstNameLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="firstName"
              name="firstName"
              required
              aria-invalid={fieldErrors.firstName ? true : undefined}
            />
            {fieldErrors.firstName ? <FieldError>{fieldErrors.firstName}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldErrors.lastName ? true : undefined}>
            <FieldLabel htmlFor="lastName">
              {t("lastNameLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="lastName"
              name="lastName"
              required
              aria-invalid={fieldErrors.lastName ? true : undefined}
            />
            {fieldErrors.lastName ? <FieldError>{fieldErrors.lastName}</FieldError> : null}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={fieldErrors.birthDate ? true : undefined}>
            <FieldLabel htmlFor="birthDate">
              {t("birthDateLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              aria-invalid={fieldErrors.birthDate ? true : undefined}
            />
            {fieldErrors.birthDate ? <FieldError>{fieldErrors.birthDate}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldErrors.nationalId ? true : undefined}>
            <FieldLabel htmlFor="nationalId">{t("nationalIdLabel")}</FieldLabel>
            <Input
              id="nationalId"
              name="nationalId"
              placeholder={t("nationalIdPlaceholder")}
              aria-invalid={fieldErrors.nationalId ? true : undefined}
            />
            {fieldErrors.nationalId ? <FieldError>{fieldErrors.nationalId}</FieldError> : null}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={fieldErrors.address ? true : undefined}>
            <FieldLabel htmlFor="address">
              {t("addressLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="address"
              name="address"
              required
              aria-invalid={fieldErrors.address ? true : undefined}
            />
            {fieldErrors.address ? <FieldError>{fieldErrors.address}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldErrors.city ? true : undefined}>
            <FieldLabel htmlFor="city">
              {t("cityLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="city"
              name="city"
              required
              aria-invalid={fieldErrors.city ? true : undefined}
            />
            {fieldErrors.city ? <FieldError>{fieldErrors.city}</FieldError> : null}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={fieldErrors.phone ? true : undefined}>
            <FieldLabel htmlFor="phone">
              {t("phoneLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              aria-invalid={fieldErrors.phone ? true : undefined}
            />
            {fieldErrors.phone ? <FieldError>{fieldErrors.phone}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldErrors.email ? true : undefined}>
            <FieldLabel htmlFor="email">
              {t("emailLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              aria-invalid={fieldErrors.email ? true : undefined}
            />
            {fieldErrors.email ? <FieldError>{fieldErrors.email}</FieldError> : null}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field data-invalid={fieldErrors.shirtSize ? true : undefined}>
            <FieldLabel htmlFor="shirtSize">
              {t("shirtSizeLabel")}
              <Req />
            </FieldLabel>
            <Select value={shirtSize} onValueChange={(v) => setShirtSize(v ?? "")}>
              <SelectTrigger
                id="shirtSize"
                className="w-full"
                aria-invalid={fieldErrors.shirtSize ? true : undefined}
              >
                <SelectValue placeholder={t("sizePlaceholder")}>
                  {(v: string) => v || t("sizePlaceholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CLOTHING_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="shirtSize" value={shirtSize} />
            {fieldErrors.shirtSize ? <FieldError>{fieldErrors.shirtSize}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldErrors.pantsSize ? true : undefined}>
            <FieldLabel htmlFor="pantsSize">
              {t("pantsSizeLabel")}
              <Req />
            </FieldLabel>
            <Select value={pantsSize} onValueChange={(v) => setPantsSize(v ?? "")}>
              <SelectTrigger
                id="pantsSize"
                className="w-full"
                aria-invalid={fieldErrors.pantsSize ? true : undefined}
              >
                <SelectValue placeholder={t("sizePlaceholder")}>
                  {(v: string) => v || t("sizePlaceholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CLOTHING_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="pantsSize" value={pantsSize} />
            {fieldErrors.pantsSize ? <FieldError>{fieldErrors.pantsSize}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldErrors.shoeSize ? true : undefined}>
            <FieldLabel htmlFor="shoeSize">
              {t("shoeSizeLabel")}
              <Req />
            </FieldLabel>
            <Select value={shoeSize} onValueChange={(v) => setShoeSize(v ?? "")}>
              <SelectTrigger
                id="shoeSize"
                className="w-full"
                aria-invalid={fieldErrors.shoeSize ? true : undefined}
              >
                <SelectValue placeholder={t("sizePlaceholder")}>
                  {(v: string) => v || t("sizePlaceholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SHOE_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="shoeSize" value={shoeSize} />
            {fieldErrors.shoeSize ? <FieldError>{fieldErrors.shoeSize}</FieldError> : null}
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
          {fieldErrors.guardians ? <FieldError>{fieldErrors.guardians}</FieldError> : null}
          {guardianKeys.map((key, i) => {
            const nameError = fieldErrors[`guardian-${i}-name`];
            const birthDateError = fieldErrors[`guardian-${i}-birthDate`];
            const phoneError = fieldErrors[`guardian-${i}-phone`];
            const emailError = fieldErrors[`guardian-${i}-email`];
            const addressError = fieldErrors[`guardian-${i}-address`];
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
                      onClick={() =>
                        setGuardianKeys((prev) => prev.filter((k) => k !== key))
                      }
                      aria-label={t("removeGuardianSr", { index: i + 1 })}
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={nameError ? true : undefined}>
                    <FieldLabel htmlFor={`guardian-${key}-firstName`}>
                      {t("firstNameLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-firstName`}
                      name="guardianFirstName"
                      required={showGuardians}
                      aria-invalid={nameError ? true : undefined}
                    />
                  </Field>
                  <Field data-invalid={nameError ? true : undefined}>
                    <FieldLabel htmlFor={`guardian-${key}-lastName`}>
                      {t("lastNameLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-lastName`}
                      name="guardianLastName"
                      required={showGuardians}
                      aria-invalid={nameError ? true : undefined}
                    />
                    {nameError ? <FieldError>{nameError}</FieldError> : null}
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={birthDateError ? true : undefined}>
                    <FieldLabel htmlFor={`guardian-${key}-birthDate`}>
                      {t("birthDateLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-birthDate`}
                      name="guardianBirthDate"
                      type="date"
                      required={showGuardians}
                      aria-invalid={birthDateError ? true : undefined}
                    />
                    {birthDateError ? <FieldError>{birthDateError}</FieldError> : null}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`guardian-${key}-nationalId`}>
                      {t("nationalIdLabel")}
                    </FieldLabel>
                    <Input id={`guardian-${key}-nationalId`} name="guardianNationalId" />
                  </Field>
                </div>
                <Field data-invalid={addressError ? true : undefined}>
                  <FieldLabel htmlFor={`guardian-${key}-address`}>
                    {t("addressLabel")}
                    <Req />
                  </FieldLabel>
                  <Input
                    id={`guardian-${key}-address`}
                    name="guardianAddress"
                    required={showGuardians}
                    aria-invalid={addressError ? true : undefined}
                  />
                  {addressError ? <FieldError>{addressError}</FieldError> : null}
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={phoneError ? true : undefined}>
                    <FieldLabel htmlFor={`guardian-${key}-phone`}>
                      {t("phoneLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-phone`}
                      name="guardianPhone"
                      type="tel"
                      required={showGuardians}
                      aria-invalid={phoneError ? true : undefined}
                    />
                    {phoneError ? <FieldError>{phoneError}</FieldError> : null}
                  </Field>
                  <Field data-invalid={emailError ? true : undefined}>
                    <FieldLabel htmlFor={`guardian-${key}-email`}>
                      {t("emailLabel")}
                      <Req />
                    </FieldLabel>
                    <Input
                      id={`guardian-${key}-email`}
                      name="guardianEmail"
                      type="email"
                      required={showGuardians}
                      aria-invalid={emailError ? true : undefined}
                    />
                    {emailError ? <FieldError>{emailError}</FieldError> : null}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={fieldErrors.iban ? true : undefined}>
            <FieldLabel htmlFor="iban">
              {t("ibanLabel")}
              <Req />
            </FieldLabel>
            <Input
              id="iban"
              name="iban"
              placeholder="ES00 0000 0000 0000 0000 0000"
              required
              aria-invalid={fieldErrors.iban ? true : undefined}
            />
            <p className="text-xs text-muted-foreground">
              {t(showGuardians ? "playerIbanHintMinor" : "playerIbanHintAdult")}
            </p>
            {fieldErrors.iban ? <FieldError>{fieldErrors.iban}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="installmentsChosen">{t("installmentsLabel")}</FieldLabel>
            <Select
              value={installments}
              onValueChange={(v) => setInstallments(v ?? "1")}
            >
              <SelectTrigger id="installmentsChosen" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === "2" ? t("installmentsTwo") : t("installmentsOne")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("installmentsOne")}</SelectItem>
                <SelectItem value="2">{t("installmentsTwo")}</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="installmentsChosen" value={installments} />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox
            id="sepaConsent"
            name="sepaConsent"
            required
            inputRef={sepaConsent.inputRef}
            aria-invalid={sepaConsent.error || fieldErrors.sepaConsent ? true : undefined}
            aria-describedby={
              sepaConsent.error || fieldErrors.sepaConsent ? "sepaConsent-error" : undefined
            }
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
        {sepaConsent.error || fieldErrors.sepaConsent ? (
          <p id="sepaConsent-error" className="text-sm text-destructive">
            {t("sepaConsentRequired")}
          </p>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("documentsSection")}
        </h2>
        <PhotoField
          id="photo"
          name="photo"
          label={
            <>
              {t("photoLabel")}
              <Req />
            </>
          }
          hint={t("photoSizeHint")}
          error={fieldErrors.photo}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoField
            id="idFront"
            name="idFront"
            label={
              <>
                {t("idFrontLabel")}
                <Req />
              </>
            }
            hint={t("photoSizeHint")}
            error={fieldErrors.idFront}
          />
          <PhotoField
            id="idBack"
            name="idBack"
            label={
              <>
                {t("idBackLabel")}
                <Req />
              </>
            }
            hint={t("photoSizeHint")}
            error={fieldErrors.idBack}
          />
        </div>
        <Field orientation="horizontal">
          <Checkbox id="photoConsent" name="photoConsent" />
          <Label htmlFor="photoConsent" className="font-normal">
            {t("imageConsentLabel")}
          </Label>
        </Field>
        <Link
          href="/inscripcion/jugador/imagen"
          target="_blank"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          {t("imageConsentMoreInfo")}
        </Link>
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="termsConsent"
            name="termsConsent"
            required
            inputRef={termsConsent.inputRef}
            aria-invalid={termsConsent.error || fieldErrors.termsConsent ? true : undefined}
            aria-describedby={
              termsConsent.error || fieldErrors.termsConsent ? "termsConsent-error" : undefined
            }
            onCheckedChange={(checked) => {
              if (checked) termsConsent.clear();
            }}
          />
          <Label htmlFor="termsConsent" className="font-normal">
            {t("termsConsentLabel")}
            <Req />
          </Label>
        </Field>
        <Link
          href="/inscripcion/jugador/condiciones"
          target="_blank"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          {t("termsConsentMoreInfo")}
        </Link>
        {termsConsent.error || fieldErrors.termsConsent ? (
          <p id="termsConsent-error" className="text-sm text-destructive">
            {t("termsConsentRequired")}
          </p>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="privacyConsent"
            name="privacyConsent"
            required
            inputRef={privacyConsent.inputRef}
            aria-invalid={
              privacyConsent.error || fieldErrors.privacyConsent ? true : undefined
            }
            aria-describedby={
              privacyConsent.error || fieldErrors.privacyConsent
                ? "privacyConsent-error"
                : undefined
            }
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
        {privacyConsent.error || fieldErrors.privacyConsent ? (
          <p id="privacyConsent-error" className="text-sm text-destructive">
            {t("privacyConsentRequired")}
          </p>
        ) : null}
      </FieldGroup>

      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">{t("submitAction")}</SubmitButton>
    </form>
  );
}
