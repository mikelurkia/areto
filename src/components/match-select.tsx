"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { calculateAge } from "@/lib/age";
import { Link, usePathname } from "@/i18n/navigation";
import { MaskedIbanText } from "@/components/masked-iban";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PersonCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  nationalId?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  iban?: string | null;
  shirtSize?: string | null;
  pantsSize?: string | null;
  shoeSize?: string | null;
  photoUrl?: string | null;
  idFrontUrl?: string | null;
  idBackUrl?: string | null;
};

const FIELD_LABEL_KEYS: Record<string, string> = {
  firstName: "firstNameLabel",
  lastName: "lastNameLabel",
  birthDate: "birthDateLabel",
  nationalId: "nationalIdLabel",
  address: "addressLabel",
  city: "cityLabel",
  phone: "phoneLabel",
  email: "emailLabel",
  iban: "ibanLabel",
  shirtSize: "shirtSizeLabel",
  pantsSize: "pantsSizeLabel",
  shoeSize: "shoeSizeLabel",
};

/** Muestra un consentimiento tal como se envió, sin permitir editarlo: el
 * registro debe reflejar siempre fielmente lo que la persona autorizó. */
export function ConsentRow({ label, granted }: { label: string; granted: boolean }) {
  const t = useTranslations("Inscripciones");
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <Badge variant={granted ? "secondary" : "outline"}>
        {granted ? t("consentYes") : t("consentNo")}
      </Badge>
    </div>
  );
}

/** Fila de comparación para una foto/documento: dos miniaturas (actual y
 * nueva) y el mismo checkbox "mantener el actual" que los campos de texto. */
function PhotoDiffRow({
  label,
  currentUrl,
  newUrl,
  checkboxId,
}: {
  label: string;
  currentUrl: string;
  newUrl: string;
  checkboxId: string;
}) {
  const t = useTranslations("Inscripciones");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("currentValueLabel")}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="" className="h-16 w-16 rounded-lg border object-cover" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("newValueLabel")}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={newUrl} alt="" className="h-16 w-16 rounded-lg border object-cover" />
        </div>
        <p className="font-medium">{label}</p>
      </div>
      <Field orientation="horizontal" className="w-auto shrink-0">
        <Checkbox id={checkboxId} name={checkboxId} />
        <Label htmlFor={checkboxId} className="font-normal text-xs whitespace-nowrap">
          {t("keepOriginalValue")}
        </Label>
      </Field>
    </div>
  );
}

/**
 * Selector "¿es la misma persona que...?": si se elige un candidato, muestra
 * el diff entre sus datos actuales y los nuevos, con un checkbox "mantener el
 * valor actual" por campo cambiado (y por foto/DNI, si aplica). Compartido
 * entre la revisión de inscripciones (jugador/equipo y socio) y el alta
 * manual de persona — cada consumidor le pasa su propia lista de `diffFields`
 * según qué datos recoja su formulario.
 */
export function MatchSelect({
  name,
  candidates,
  placeholder,
  newValues,
  diffFields,
  keepPrefix,
  photoDiff,
}: {
  name: string;
  candidates: PersonCandidate[];
  placeholder: string;
  newValues: Record<string, string | null>;
  diffFields: readonly string[];
  keepPrefix: string;
  /** Solo la persona principal tiene foto/DNI nuevos que comparar. */
  photoDiff?: { newPhotoUrl: string | null; newIdFrontUrl: string | null; newIdBackUrl: string | null };
}) {
  const t = useTranslations("Inscripciones");
  const pathname = usePathname();
  const [value, setValue] = useState(candidates.length === 1 ? candidates[0].id : "new");
  const selected = value !== "new" ? candidates.find((c) => c.id === value) ?? null : null;
  const changedFields = selected
    ? diffFields.filter((key) => {
        const current = (selected[key as keyof PersonCandidate] as string | null | undefined) ?? "";
        const next = newValues[key] ?? "";
        return current.trim() !== next.trim();
      })
    : [];
  const photoCandidates: { key: string; label: string; current: string | null; next: string | null }[] =
    selected && photoDiff
      ? [
          { key: "photo", label: t("photoLabel"), current: selected.photoUrl ?? null, next: photoDiff.newPhotoUrl },
          {
            key: "idFront",
            label: t("idFrontLabel"),
            current: selected.idFrontUrl ?? null,
            next: photoDiff.newIdFrontUrl,
          },
          {
            key: "idBack",
            label: t("idBackLabel"),
            current: selected.idBackUrl ?? null,
            next: photoDiff.newIdBackUrl,
          },
        ]
      : [];
  const photoRows = photoCandidates.filter(
    (row): row is { key: string; label: string; current: string; next: string } => !!row.current && !!row.next,
  );

  return (
    <Field>
      <FieldLabel>{placeholder}</FieldLabel>
      <Select value={value} onValueChange={(v) => setValue(v ?? "new")}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {(v: string) => {
              if (v === "new") return t("createNewPerson");
              const c = candidates.find((x) => x.id === v);
              return c ? `${c.firstName} ${c.lastName}` : t("createNewPerson");
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">{t("createNewPerson")}</SelectItem>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
      {candidates.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {candidates.map((c) => {
            const age = c.birthDate ? calculateAge(c.birthDate) : null;
            return (
              <Link
                key={c.id}
                href={`/personas/${c.id}?from=${encodeURIComponent(pathname)}`}
                target="_blank"
                className="text-xs"
              >
                <Badge variant="outline" className="hover:bg-muted">
                  {t("possibleMatchBadge")}: {c.firstName} {c.lastName}
                  {age != null ? ` · ${t("ageYears", { count: age })}` : ""}
                  {c.nationalId ? ` · ${c.nationalId}` : ""}
                </Badge>
              </Link>
            );
          })}
        </div>
      ) : null}
      {selected && (changedFields.length > 0 || photoRows.length > 0) ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("changesDetectedTitle")}
          </p>
          {photoRows.map((row) => (
            <PhotoDiffRow
              key={row.key}
              label={row.label}
              currentUrl={row.current}
              newUrl={row.next}
              checkboxId={`keep_${keepPrefix}_${row.key}`}
            />
          ))}
          {changedFields.map((key) => {
            const current = (selected[key as keyof PersonCandidate] as string | null | undefined) || "—";
            const next = newValues[key] || "—";
            const checkboxId = `keep_${keepPrefix}_${key}`;
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{t(FIELD_LABEL_KEYS[key])}</p>
                  <p className="text-muted-foreground">
                    {t("currentValueLabel")}:{" "}
                    {key === "iban" && current !== "—" ? <MaskedIbanText value={current} /> : current} →{" "}
                    {t("newValueLabel")}:{" "}
                    {key === "iban" && next !== "—" ? <MaskedIbanText value={next} /> : next}
                  </p>
                </div>
                <Field orientation="horizontal" className="w-auto shrink-0">
                  <Checkbox id={checkboxId} name={checkboxId} />
                  <Label htmlFor={checkboxId} className="font-normal text-xs whitespace-nowrap">
                    {t("keepOriginalValue")}
                  </Label>
                </Field>
              </div>
            );
          })}
        </div>
      ) : null}
    </Field>
  );
}
