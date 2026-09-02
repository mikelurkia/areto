"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  approveRegistration,
  rejectRegistration,
  updateRegistration,
} from "@/app/[locale]/(app)/inscripciones/actions";
import { ConsentRow, MatchSelect, type PersonCandidate } from "@/components/match-select";
import { GuardianBlock, type GuardianData } from "@/components/inscripciones/guardian-review-fields";
import { MaskedIbanInput } from "@/components/masked-iban";
import { SectionHeading } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";

/** Igual que `PERSON_DIFF_FIELDS` de `review-form.tsx` pero sin tallas: un
 * socio no las tiene, y compararlas aquí es lo que hacía aparecer "Talla
 * camiseta: M → —" al vincular con una persona que ya fuera jugador. */
const MEMBER_DIFF_FIELDS = [
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
] as const;

/** Igual que en `review-form.tsx`: si el socio es menor y tiene tutor, el
 * iban ya no se compara sobre él (lo compara `GuardianBlock` en el tutor
 * pagador). */
const MEMBER_DIFF_FIELDS_WITHOUT_IBAN = MEMBER_DIFF_FIELDS.filter((f) => f !== "iban");

export type MemberRegistrationDetail = {
  id: string;
  kind: "member";
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
  sepaConsent: boolean;
  privacyConsent: boolean;
  candidates: PersonCandidate[];
  guardians: GuardianData[];
};

export function MemberReviewForm({ registration }: { registration: MemberRegistrationDetail }) {
  const t = useTranslations("Inscripciones");

  const [editState, editAction] = useActionState(updateRegistration, {});
  useActionToast(editState);
  const [approveState, approveAction] = useActionState(approveRegistration, {});
  useActionToast(approveState);
  const [rejectState, rejectAction] = useActionState(rejectRegistration, {});
  useActionToast(rejectState);
  const hasGuardians = registration.guardians.length > 0;

  return (
    <form className="flex flex-col gap-6">
      <input type="hidden" name="id" value={registration.id} />
      <input type="hidden" name="kind" value={registration.kind} />

      <Card className="gap-3 px-(--card-spacing)">
        <SectionHeading title={t("memberSection")} />
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

        <div className="border-t pt-3">
          <MatchSelect
            name="matchedPersonId"
            candidates={registration.candidates}
            placeholder={t("memberMatchLabel")}
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
            }}
            diffFields={hasGuardians ? MEMBER_DIFF_FIELDS_WITHOUT_IBAN : MEMBER_DIFF_FIELDS}
            keepPrefix="person"
          />
        </div>
      </Card>

      <GuardianBlock guardians={registration.guardians} registrationIban={registration.iban} />

      <Card className="gap-3 px-(--card-spacing)">
        <SectionHeading title={t("paymentSection")} />
        <Field>
          <FieldLabel htmlFor="iban">{t("ibanLabel")}</FieldLabel>
          <MaskedIbanInput id="iban" name="iban" defaultValue={registration.iban ?? ""} />
        </Field>
        <Card size="sm" className="gap-2 px-(--card-spacing)">
          <ConsentRow label={t("sepaConsentShortLabel")} granted={registration.sepaConsent} />
          <ConsentRow label={t("privacyConsentShortLabel")} granted={registration.privacyConsent} />
        </Card>
      </Card>

      <Card className="gap-4 px-(--card-spacing)">
        <SectionHeading title={t("reviewSection")} />

        {editState.error ? <p className="text-sm text-destructive">{editState.error}</p> : null}
        {approveState.error ? (
          <p className="text-sm text-destructive">{approveState.error}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton formAction={editAction} variant="outline">
            {t("saveChangesAction")}
          </SubmitButton>
          <SubmitButton formAction={approveAction}>{t("approveAction")}</SubmitButton>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <Field>
            <FieldLabel htmlFor="rejectionReason">{t("rejectionReasonLabel")}</FieldLabel>
            <Textarea id="rejectionReason" name="rejectionReason" placeholder={t("rejectionReasonPlaceholder")} />
          </Field>
          {rejectState.error ? (
            <p className="text-sm text-destructive">{rejectState.error}</p>
          ) : null}
          <div>
            <SubmitButton formAction={rejectAction} variant="destructive">
              {t("rejectAction")}
            </SubmitButton>
          </div>
        </div>
      </Card>
    </form>
  );
}
