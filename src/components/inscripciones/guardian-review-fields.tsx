"use client";

import { useRef, useState } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { MatchSelect, type PersonCandidate } from "@/components/match-select";
import { SectionHeading } from "@/components/page-header";
import { Card } from "@/components/ui/card";
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
 * Bloque de edición + vinculación de tutores, un `Card` por tutor: añadir/
 * quitar filas, datos de contacto, y —para los que ya existían al cargar la
 * página, con `candidates` calculados en el servidor— su `MatchSelect` de
 * vinculación justo debajo, en la misma tarjeta. Un tutor añadido en esta
 * misma sesión de edición no tiene candidatos con los que comparar (se
 * calculan al renderizar la página), así que no lleva selector: se procesará
 * como persona nueva al aprobar. Un tutor es un tutor sea la inscripción de
 * jugador o de socio, así que este bloque es compartido entre
 * `review-form.tsx` y `member-review-form.tsx`.
 */
export function GuardianBlock({
  guardians,
  registrationIban,
}: {
  guardians: GuardianData[];
  registrationIban: string | null;
}) {
  const t = useTranslations("Inscripciones");
  const [guardianKeys, setGuardianKeys] = useState<number[]>(
    guardians.length > 0 ? guardians.map((_, i) => i) : [],
  );
  const nextGuardianKey = useRef(guardianKeys.length);
  const [names, setNames] = useState<Record<number, string>>(
    Object.fromEntries(guardians.map((g, i) => [i, `${g.firstName} ${g.lastName}`.trim()])),
  );

  return (
    <FieldGroup>
      <SectionHeading
        title={t("guardiansSection")}
        actions={
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            onClick={() => setGuardianKeys((prev) => [...prev, nextGuardianKey.current++])}
          >
            <PlusIcon className="size-4" />
            {t("addGuardianAction")}
          </button>
        }
      />
      {guardianKeys.map((key, i) => {
        const existing = guardians[key];
        const isPayer = i === 0;
        const name = names[key];
        return (
          <Card key={key} className="gap-3 px-(--card-spacing)">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("guardianLabel")} {i + 1}
                {name ? ` — ${name}` : ""}
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
                <Input
                  name="guardianFirstName"
                  defaultValue={existing?.firstName ?? ""}
                  onChange={(e) =>
                    setNames((prev) => ({
                      ...prev,
                      [key]: `${e.target.value} ${existing?.lastName ?? ""}`.trim(),
                    }))
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel>{t("lastNameLabel")}</FieldLabel>
                <Input
                  name="guardianLastName"
                  defaultValue={existing?.lastName ?? ""}
                  onChange={(e) =>
                    setNames((prev) => ({
                      ...prev,
                      [key]: `${existing?.firstName ?? ""} ${e.target.value}`.trim(),
                    }))
                  }
                  required
                />
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

            {existing ? (
              <div className="border-t pt-3">
                <MatchSelect
                  name={`matchedFor_${i}`}
                  candidates={existing.candidates}
                  placeholder={t("guardianMatchLabel", { index: i + 1 })}
                  newValues={{
                    firstName: existing.firstName,
                    lastName: existing.lastName,
                    birthDate: existing.birthDate,
                    nationalId: existing.nationalId,
                    address: existing.address,
                    city: existing.city,
                    postalCode: existing.postalCode,
                    phone: existing.phone,
                    email: existing.email,
                    ...(isPayer ? { iban: registrationIban } : {}),
                  }}
                  diffFields={isPayer ? GUARDIAN_PAYER_DIFF_FIELDS : GUARDIAN_DIFF_FIELDS}
                  keepPrefix={`guardian_${i}`}
                />
              </div>
            ) : null}
          </Card>
        );
      })}
    </FieldGroup>
  );
}
