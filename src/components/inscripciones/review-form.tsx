"use client";

import { useActionState, useRef, useState } from "react";
import { PlusIcon, TrashIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  approveRegistration,
  rejectRegistration,
  updateRegistration,
} from "@/app/[locale]/(app)/inscripciones/actions";
import { isBirthYearOutOfRange } from "@/lib/roster-health";
import { Link, usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
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
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";

type PersonCandidate = {
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

/** Campos que `approveRegistration` sobrescribe hoy al vincular con una
 * persona existente (sin los consentimientos, que siempre toman el valor
 * recién enviado). Los tutores no llevan `city`/tallas. El `iban` solo se
 * compara aquí cuando no hay tutores: un menor no puede ser titular de un
 * mandato SEPA, así que si los hay el iban se compara en el tutor principal
 * (ver `GUARDIAN_PAYER_DIFF_FIELDS`), no en el jugador. */
const PERSON_DIFF_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "phone",
  "email",
  "iban",
  "shirtSize",
  "pantsSize",
  "shoeSize",
] as const;

const PERSON_DIFF_FIELDS_WITHOUT_IBAN = PERSON_DIFF_FIELDS.filter((f) => f !== "iban");

const GUARDIAN_DIFF_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "phone",
  "email",
] as const;

/** El tutor principal (el primero de la lista) es quien domicilia la cuota. */
const GUARDIAN_PAYER_DIFF_FIELDS = [...GUARDIAN_DIFF_FIELDS, "iban"] as const;

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

type GuardianData = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationalId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  candidates: PersonCandidate[];
};

/** Muestra un consentimiento tal como se envió, sin permitir editarlo: el
 * registro debe reflejar siempre fielmente lo que la persona autorizó. */
function ConsentRow({ label, granted }: { label: string; granted: boolean }) {
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

export type RegistrationDetail = {
  id: string;
  kind: "player" | "member";
  status: "pending" | "approved" | "rejected";
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
  shoeSize: string | null;
  installmentsChosen: number | null;
  sepaConsent: boolean;
  termsConsent: boolean;
  photoConsent: boolean;
  privacyConsent: boolean;
  newPhotoUrl: string | null;
  newIdFrontUrl: string | null;
  newIdBackUrl: string | null;
  candidates: PersonCandidate[];
  guardians: GuardianData[];
};

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

function MatchSelect({
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
          {candidates.map((c) => (
            <Link
              key={c.id}
              href={`/personas/${c.id}?from=${encodeURIComponent(pathname)}`}
              target="_blank"
              className="text-xs"
            >
              <Badge variant="outline" className="hover:bg-muted">
                {t("possibleMatchBadge")}: {c.firstName} {c.lastName}
              </Badge>
            </Link>
          ))}
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
                    {t("currentValueLabel")}: {current} → {t("newValueLabel")}: {next}
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

export function ReviewForm({
  registration,
  teamOptions,
}: {
  registration: RegistrationDetail;
  teamOptions: {
    id: string;
    label: string;
    minBirthYear: number | null;
    maxBirthYear: number | null;
  }[];
}) {
  const t = useTranslations("Inscripciones");
  const tEquipos = useTranslations("Equipos");

  const [editState, editAction] = useActionState(updateRegistration, {});
  useActionToast(editState);
  const [approveState, approveAction] = useActionState(approveRegistration, {});
  useActionToast(approveState);
  const [rejectState, rejectAction] = useActionState(rejectRegistration, {});
  useActionToast(rejectState);

  const [installments, setInstallments] = useState(
    registration.installmentsChosen === 2 ? "2" : "1",
  );
  const [guardianKeys, setGuardianKeys] = useState<number[]>(
    registration.guardians.length > 0 ? registration.guardians.map((_, i) => i) : [],
  );
  const nextGuardianKey = useRef(guardianKeys.length);
  const [teamId, setTeamId] = useState("");
  const [membershipRole, setMembershipRole] = useState<"player" | "coach" | "staff">("player");
  const hasGuardians = registration.kind === "player" && registration.guardians.length > 0;
  const selectedTeam = teamOptions.find((o) => o.id === teamId) ?? null;
  const teamAgeMismatch =
    membershipRole === "player" &&
    selectedTeam !== null &&
    isBirthYearOutOfRange(registration.birthDate, selectedTeam);

  return (
    <div className="flex flex-col gap-8">
      <form action={editAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={registration.id} />
        <FieldGroup>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t(registration.kind === "player" ? "playerSection" : "memberSection")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firstName">{t("firstNameLabel")}</FieldLabel>
              <Input id="firstName" name="firstName" defaultValue={registration.firstName} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">{t("lastNameLabel")}</FieldLabel>
              <Input id="lastName" name="lastName" defaultValue={registration.lastName} required />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="birthDate">{t("birthDateLabel")}</FieldLabel>
              <Input id="birthDate" name="birthDate" type="date" defaultValue={registration.birthDate ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="nationalId">{t("nationalIdLabel")}</FieldLabel>
              <Input id="nationalId" name="nationalId" defaultValue={registration.nationalId ?? ""} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="address">{t("addressLabel")}</FieldLabel>
              <Input id="address" name="address" defaultValue={registration.address ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="city">{t("cityLabel")}</FieldLabel>
              <Input id="city" name="city" defaultValue={registration.city ?? ""} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="phone">{t("phoneLabel")}</FieldLabel>
              <Input id="phone" name="phone" defaultValue={registration.phone ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
              <Input id="email" name="email" defaultValue={registration.email ?? ""} />
            </Field>
          </div>
          {registration.kind === "player" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="shirtSize">{t("shirtSizeLabel")}</FieldLabel>
                <Input id="shirtSize" name="shirtSize" defaultValue={registration.shirtSize ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pantsSize">{t("pantsSizeLabel")}</FieldLabel>
                <Input id="pantsSize" name="pantsSize" defaultValue={registration.pantsSize ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="shoeSize">{t("shoeSizeLabel")}</FieldLabel>
                <Input id="shoeSize" name="shoeSize" defaultValue={registration.shoeSize ?? ""} />
              </Field>
            </div>
          ) : null}
        </FieldGroup>

        {registration.kind === "player" ? (
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
              const existing = registration.guardians[key];
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
                  <Field>
                    <FieldLabel>{t("addressLabel")}</FieldLabel>
                    <Input name="guardianAddress" defaultValue={existing?.address ?? ""} />
                  </Field>
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
        ) : null}

        <FieldGroup>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("paymentSection")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="iban">{t("ibanLabel")}</FieldLabel>
              <Input id="iban" name="iban" defaultValue={registration.iban ?? ""} />
            </Field>
            {registration.kind === "player" ? (
              <Field>
                <FieldLabel htmlFor="installmentsChosen">{t("installmentsLabel")}</FieldLabel>
                <Select value={installments} onValueChange={(v) => setInstallments(v ?? "1")}>
                  <SelectTrigger id="installmentsChosen" className="w-full">
                    <SelectValue>
                      {(v: string) => (v === "2" ? t("installmentsTwo") : t("installmentsOne"))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("installmentsOne")}</SelectItem>
                    <SelectItem value="2">{t("installmentsTwo")}</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="installmentsChosen" value={installments} />
              </Field>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <ConsentRow label={t("sepaConsentShortLabel")} granted={registration.sepaConsent} />
            {registration.kind === "player" ? (
              <ConsentRow label={t("termsConsentShortLabel")} granted={registration.termsConsent} />
            ) : null}
            <ConsentRow label={t("imageConsentShortLabel")} granted={registration.photoConsent} />
            <ConsentRow
              label={t("privacyConsentShortLabel")}
              granted={registration.privacyConsent}
            />
          </div>
        </FieldGroup>

        {editState.error ? <p className="text-sm text-destructive">{editState.error}</p> : null}
        <div>
          <SubmitButton variant="outline">{t("saveChangesAction")}</SubmitButton>
        </div>
      </form>

      <div className="flex flex-col gap-6 rounded-lg border p-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("reviewSection")}
        </h2>
        <form action={approveAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={registration.id} />
          {registration.kind !== "member" ? (
            <>
              <Field>
                <FieldLabel htmlFor="teamId">{t("teamLabel")}</FieldLabel>
                <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "")}>
                  <SelectTrigger id="teamId" className="w-full">
                    <SelectValue placeholder={t("selectTeamPlaceholder")}>
                      {(v: string) => teamOptions.find((o) => o.id === v)?.label ?? t("selectTeamPlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {teamOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="teamId" value={teamId} />
                <p className="text-xs text-muted-foreground">{t("teamOptionalHint")}</p>
                {teamAgeMismatch && selectedTeam ? (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                    <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                    {t("teamAgeMismatchWarning", {
                      min: selectedTeam.minBirthYear ?? "",
                      max: selectedTeam.maxBirthYear ?? "",
                      year: registration.birthDate ? registration.birthDate.slice(0, 4) : "",
                    })}
                  </p>
                ) : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="membershipRole">{tEquipos("roleLabel")}</FieldLabel>
                <Select
                  value={membershipRole}
                  onValueChange={(v) => setMembershipRole((v as typeof membershipRole) ?? "player")}
                >
                  <SelectTrigger id="membershipRole" className="w-full">
                    <SelectValue>{(v: string) => tEquipos(`roleOption.${v}` as "roleOption.player")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">{tEquipos("roleOption.player")}</SelectItem>
                    <SelectItem value="coach">{tEquipos("roleOption.coach")}</SelectItem>
                    <SelectItem value="staff">{tEquipos("roleOption.staff")}</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="membershipRole" value={membershipRole} />
              </Field>
            </>
          ) : null}

          <MatchSelect
            name="matchedPersonId"
            candidates={registration.candidates}
            placeholder={t(registration.kind === "player" ? "playerMatchLabel" : "memberMatchLabel")}
            newValues={{
              firstName: registration.firstName,
              lastName: registration.lastName,
              birthDate: registration.birthDate,
              nationalId: registration.nationalId,
              address: registration.address,
              city: registration.city,
              phone: registration.phone,
              email: registration.email,
              iban: hasGuardians ? null : registration.iban,
              shirtSize: registration.shirtSize,
              pantsSize: registration.pantsSize,
              shoeSize: registration.shoeSize,
            }}
            diffFields={hasGuardians ? PERSON_DIFF_FIELDS_WITHOUT_IBAN : PERSON_DIFF_FIELDS}
            keepPrefix="person"
            photoDiff={{
              newPhotoUrl: registration.newPhotoUrl,
              newIdFrontUrl: registration.newIdFrontUrl,
              newIdBackUrl: registration.newIdBackUrl,
            }}
          />

          {registration.guardians.map((g, i) => {
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
                  phone: g.phone,
                  email: g.email,
                  ...(isPayer ? { iban: registration.iban } : {}),
                }}
                diffFields={isPayer ? GUARDIAN_PAYER_DIFF_FIELDS : GUARDIAN_DIFF_FIELDS}
                keepPrefix={`guardian_${g.id}`}
              />
            );
          })}

          {approveState.error ? (
            <p className="text-sm text-destructive">{approveState.error}</p>
          ) : null}
          <div>
            <SubmitButton>{t("approveAction")}</SubmitButton>
          </div>
        </form>

        <form action={rejectAction} className="flex flex-col gap-3 border-t pt-4">
          <input type="hidden" name="id" value={registration.id} />
          <Field>
            <FieldLabel htmlFor="rejectionReason">{t("rejectionReasonLabel")}</FieldLabel>
            <Textarea id="rejectionReason" name="rejectionReason" placeholder={t("rejectionReasonPlaceholder")} />
          </Field>
          {rejectState.error ? (
            <p className="text-sm text-destructive">{rejectState.error}</p>
          ) : null}
          <div>
            <SubmitButton variant="destructive">{t("rejectAction")}</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
