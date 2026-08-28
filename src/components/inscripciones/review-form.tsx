"use client";

import { useActionState, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  approveRegistration,
  rejectRegistration,
  updateRegistration,
} from "@/app/[locale]/(app)/inscripciones/actions";
import { isBirthYearOutOfRange } from "@/lib/roster-health";
import { ConsentRow, MatchSelect, type PersonCandidate } from "@/components/match-select";
import {
  GuardianEditBlock,
  GuardianMatchBlock,
  type GuardianData,
} from "@/components/inscripciones/guardian-review-fields";
import { MaskedIbanInput } from "@/components/masked-iban";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

/** Campos que `approveRegistration` sobrescribe hoy al vincular con una
 * persona existente (sin los consentimientos, que siempre toman el valor
 * recién enviado). Los tutores no llevan `city`/tallas. El `iban` solo se
 * compara aquí cuando no hay tutores: un menor no puede ser titular de un
 * mandato SEPA, así que si los hay el iban se compara en el tutor principal
 * (ver `guardian-review-fields.tsx`), no en el jugador. */
const PERSON_DIFF_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "postalCode",
  "phone",
  "email",
  "iban",
  "shirtSize",
  "pantsSize",
  "shoeSize",
] as const;

const PERSON_DIFF_FIELDS_WITHOUT_IBAN = PERSON_DIFF_FIELDS.filter((f) => f !== "iban");

export type RegistrationDetail = {
  id: string;
  kind: "player";
  status: "pending" | "approved" | "rejected";
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
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
  const [teamId, setTeamId] = useState("");
  const [membershipRole, setMembershipRole] = useState<"player" | "coach" | "staff">("player");
  const hasGuardians = registration.guardians.length > 0;
  const selectedTeam = teamOptions.find((o) => o.id === teamId) ?? null;
  const teamAgeMismatch =
    membershipRole === "player" &&
    selectedTeam !== null &&
    isBirthYearOutOfRange(registration.birthDate, selectedTeam);

  return (
    <div className="flex flex-col gap-8">
      <form action={editAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={registration.id} />
        <input type="hidden" name="kind" value={registration.kind} />
        <FieldGroup>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("playerSection")}
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
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
            <Field>
              <FieldLabel htmlFor="address">{t("addressLabel")}</FieldLabel>
              <Input id="address" name="address" defaultValue={registration.address ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="postalCode">{t("postalCodeLabel")}</FieldLabel>
              <Input
                id="postalCode"
                name="postalCode"
                inputMode="numeric"
                defaultValue={registration.postalCode ?? ""}
              />
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
        </FieldGroup>

        <GuardianEditBlock guardians={registration.guardians} />

        <FieldGroup>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("paymentSection")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="iban">{t("ibanLabel")}</FieldLabel>
              <MaskedIbanInput id="iban" name="iban" defaultValue={registration.iban ?? ""} />
            </Field>
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
          </div>
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <ConsentRow label={t("sepaConsentShortLabel")} granted={registration.sepaConsent} />
            <ConsentRow label={t("termsConsentShortLabel")} granted={registration.termsConsent} />
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
              <Alert variant="warning">
                <TriangleAlertIcon className="size-3.5" />
                <AlertDescription className="text-xs text-foreground">
                  {t("teamAgeMismatchWarning", {
                    min: selectedTeam.minBirthYear ?? "",
                    max: selectedTeam.maxBirthYear ?? "",
                    year: registration.birthDate
                      ? registration.birthDate.slice(0, 4)
                      : "",
                  })}
                </AlertDescription>
              </Alert>
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

          <MatchSelect
            name="matchedPersonId"
            candidates={registration.candidates}
            placeholder={t("playerMatchLabel")}
            newValues={{
              firstName: registration.firstName,
              lastName: registration.lastName,
              birthDate: registration.birthDate,
              nationalId: registration.nationalId,
              address: registration.address,
              city: registration.city,
              postalCode: registration.postalCode,
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

          <GuardianMatchBlock guardians={registration.guardians} registrationIban={registration.iban} />

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
