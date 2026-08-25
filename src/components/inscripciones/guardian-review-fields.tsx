"use client";

import { useRef, useState } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { MatchSelect, type PersonCandidate } from "@/components/match-select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type GuardianData = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  candidates: PersonCandidate[];
};

const GUARDIAN_DIFF_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "postalCode",
  "phone",
  "email",
] as const;

/** El tutor principal (el primero de la lista) es quien domicilia la cuota:
 * su iban sí es un campo editable/comparable, a diferencia del resto. */
const GUARDIAN_PAYER_DIFF_FIELDS = [...GUARDIAN_DIFF_FIELDS, "iban"] as const;

/**
 * Bloque de edición de tutores (añadir/quitar, datos de contacto). Un tutor es
 * un tutor sea la inscripción de jugador o de socio, así que este bloque es
 * compartido entre `review-form.tsx` y `member-review-form.tsx`. Gestiona su
 * propio estado de filas añadidas/quitadas.
 */
export function GuardianEditBlock({ guardians }: { guardians: GuardianData[] }) {
  const t = useTranslations("Inscripciones");
  const [guardianKeys, setGuardianKeys] = useState<number[]>(
    guardians.length > 0 ? guardians.map((_, i) => i) : [],
  );
  const nextGuardianKey = useRef(guardianKeys.length);

  return (
    <FieldGroup>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("guardiansSection")}
        </h2>
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          onClick={() => setGuardianKeys((prev) => [...prev, nextGuardianKey.current++])}
        >
          <PlusIcon className="size-4" />
          {t("addGuardianAction")}
        </button>
      </div>
      {guardianKeys.map((key, i) => {
        const existing = guardians[key];
        return (
          <div key={key} className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("guardianLabel")} {i + 1}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setGuardianKeys((prev) => prev.filter((k) => k !== key))}
                aria-label={t("removeGuardianSr", { index: i + 1 })}
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("firstNameLabel")}</FieldLabel>
                <Input name="guardianFirstName" defaultValue={existing?.firstName ?? ""} required />
              </Field>
              <Field>
                <FieldLabel>{t("lastNameLabel")}</FieldLabel>
                <Input name="guardianLastName" defaultValue={existing?.lastName ?? ""} required />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("birthDateLabel")}</FieldLabel>
                <Input name="guardianBirthDate" type="date" defaultValue={existing?.birthDate ?? ""} />
              </Field>
              <Field>
                <FieldLabel>{t("nationalIdLabel")}</FieldLabel>
                <Input name="guardianNationalId" defaultValue={existing?.nationalId ?? ""} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
              <Field>
                <FieldLabel>{t("addressLabel")}</FieldLabel>
                <Input name="guardianAddress" defaultValue={existing?.address ?? ""} />
              </Field>
              <Field>
                <FieldLabel>{t("postalCodeLabel")}</FieldLabel>
                <Input
                  name="guardianPostalCode"
                  inputMode="numeric"
                  defaultValue={existing?.postalCode ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>{t("cityLabel")}</FieldLabel>
                <Input name="guardianCity" defaultValue={existing?.city ?? ""} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("phoneLabel")}</FieldLabel>
                <Input name="guardianPhone" defaultValue={existing?.phone ?? ""} />
              </Field>
              <Field>
                <FieldLabel>{t("emailLabel")}</FieldLabel>
                <Input name="guardianEmail" defaultValue={existing?.email ?? ""} />
              </Field>
            </div>
          </div>
        );
      })}
    </FieldGroup>
  );
}

/**
 * Un `MatchSelect` por tutor, para vincular con una persona ya existente al
 * aprobar. El primero de la lista es el tutor pagador: solo el suyo compara
 * también el IBAN (un menor no puede ser titular de un mandato SEPA, así que
 * el resto de tutores nunca lo tienen).
 */
export function GuardianMatchBlock({
  guardians,
  registrationIban,
}: {
  guardians: GuardianData[];
  registrationIban: string | null;
}) {
  const t = useTranslations("Inscripciones");
  return (
    <>
      {guardians.map((g, i) => {
        const isPayer = i === 0;
        return (
          <MatchSelect
            key={g.id}
            name={`matchedFor_${g.id}`}
            candidates={g.candidates}
            placeholder={t("guardianMatchLabel", { index: i + 1 })}
            newValues={{
              firstName: g.firstName,
              lastName: g.lastName,
              birthDate: g.birthDate,
              nationalId: g.nationalId,
              address: g.address,
              city: g.city,
              postalCode: g.postalCode,
              phone: g.phone,
              email: g.email,
              ...(isPayer ? { iban: registrationIban } : {}),
            }}
            diffFields={isPayer ? GUARDIAN_PAYER_DIFF_FIELDS : GUARDIAN_DIFF_FIELDS}
            keepPrefix={`guardian_${g.id}`}
          />
        );
      })}
    </>
  );
}
