"use client";

import { useActionState, useState } from "react";
import { CheckCircle2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { submitPlayerRegistration } from "@/app/[locale]/inscripcion/actions";
import { isMinor } from "@/lib/age";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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

export function JugadorForm() {
  const t = useTranslations("Inscripciones");
  const [state, formAction] = useActionState(submitPlayerRegistration, {});
  const [birthDate, setBirthDate] = useState("");
  const [guardianKeys, setGuardianKeys] = useState<number[]>([0]);
  const [installments, setInstallments] = useState("1");

  const showGuardians = !birthDate || isMinor(birthDate);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <CheckCircle2Icon className="size-8 text-primary" />
        <h2 className="text-lg font-semibold">{t("successTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("successDescription")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("playerSection")}
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="shirtSize">{t("shirtSizeLabel")}</FieldLabel>
            <Input id="shirtSize" name="shirtSize" placeholder="M" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="pantsSize">{t("pantsSizeLabel")}</FieldLabel>
            <Input id="pantsSize" name="pantsSize" placeholder="M" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="shoeSize">{t("shoeSizeLabel")}</FieldLabel>
            <Input id="shoeSize" name="shoeSize" placeholder="42" required />
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
          {guardianKeys.map((key, i) => (
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
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-firstName`}>
                    {t("firstNameLabel")}
                  </FieldLabel>
                  <Input
                    id={`guardian-${key}-firstName`}
                    name="guardianFirstName"
                    required={showGuardians}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-lastName`}>
                    {t("lastNameLabel")}
                  </FieldLabel>
                  <Input
                    id={`guardian-${key}-lastName`}
                    name="guardianLastName"
                    required={showGuardians}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-birthDate`}>
                    {t("birthDateLabel")}
                  </FieldLabel>
                  <Input
                    id={`guardian-${key}-birthDate`}
                    name="guardianBirthDate"
                    type="date"
                    required={showGuardians}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-nationalId`}>
                    {t("nationalIdLabel")}
                  </FieldLabel>
                  <Input id={`guardian-${key}-nationalId`} name="guardianNationalId" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`guardian-${key}-address`}>
                  {t("addressLabel")}
                </FieldLabel>
                <Input
                  id={`guardian-${key}-address`}
                  name="guardianAddress"
                  required={showGuardians}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-phone`}>{t("phoneLabel")}</FieldLabel>
                  <Input
                    id={`guardian-${key}-phone`}
                    name="guardianPhone"
                    type="tel"
                    required={showGuardians}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`guardian-${key}-email`}>{t("emailLabel")}</FieldLabel>
                  <Input
                    id={`guardian-${key}-email`}
                    name="guardianEmail"
                    type="email"
                    required={showGuardians}
                  />
                </Field>
              </div>
            </div>
          ))}
        </FieldGroup>
      ) : null}

      <FieldGroup>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("paymentSection")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="iban">{t("ibanLabel")}</FieldLabel>
            <Input id="iban" name="iban" placeholder="ES00 0000 0000 0000 0000 0000" required />
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
          <Checkbox id="sepaConsent" name="sepaConsent" required />
          <Label htmlFor="sepaConsent" className="font-normal">
            {t("sepaConsentLabel")}
          </Label>
        </Field>
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
          <Checkbox id="imageConsent" name="imageConsent" defaultChecked />
          <Label htmlFor="imageConsent" className="font-normal">
            {t("imageConsentLabel")}
          </Label>
        </Field>
      </FieldGroup>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton size="lg">{t("submitAction")}</SubmitButton>
    </form>
  );
}
