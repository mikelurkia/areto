"use client";

import { useActionState, useRef, useState } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  approveRegistration,
  rejectRegistration,
  updateRegistration,
} from "@/app/[locale]/(app)/inscripciones/actions";
import { Link } from "@/i18n/navigation";
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

type PersonCandidate = { id: string; firstName: string; lastName: string };

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

export type RegistrationDetail = {
  id: string;
  kind: "player" | "coach";
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
  imageConsent: boolean;
  candidates: PersonCandidate[];
  guardians: GuardianData[];
};

function MatchSelect({
  name,
  candidates,
  placeholder,
}: {
  name: string;
  candidates: PersonCandidate[];
  placeholder: string;
}) {
  const t = useTranslations("Inscripciones");
  const [value, setValue] = useState(candidates.length === 1 ? candidates[0].id : "new");
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
            <Link key={c.id} href={`/personas/${c.id}`} target="_blank" className="text-xs">
              <Badge variant="outline" className="hover:bg-muted">
                {t("possibleMatchBadge")}: {c.firstName} {c.lastName}
              </Badge>
            </Link>
          ))}
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
  teamOptions: { id: string; label: string }[];
}) {
  const t = useTranslations("Inscripciones");

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

  return (
    <div className="flex flex-col gap-8">
      <form action={editAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={registration.id} />
        <FieldGroup>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t(registration.kind === "coach" ? "coachSection" : "playerSection")}
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
          {registration.kind === "player" ? (
            <Field orientation="horizontal">
              <Checkbox id="sepaConsent" name="sepaConsent" defaultChecked={registration.sepaConsent} />
              <Label htmlFor="sepaConsent" className="font-normal">
                {t("sepaConsentLabel")}
              </Label>
            </Field>
          ) : null}
          <Field orientation="horizontal">
            <Checkbox id="imageConsent" name="imageConsent" defaultChecked={registration.imageConsent} />
            <Label htmlFor="imageConsent" className="font-normal">
              {t("imageConsentLabel")}
            </Label>
          </Field>
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
          </Field>

          <MatchSelect
            name="matchedPersonId"
            candidates={registration.candidates}
            placeholder={t(registration.kind === "coach" ? "coachMatchLabel" : "playerMatchLabel")}
          />

          {registration.guardians.map((g, i) => (
            <MatchSelect
              key={g.id}
              name={`matchedFor_${g.id}`}
              candidates={g.candidates}
              placeholder={t("guardianMatchLabel", { index: i + 1 })}
            />
          ))}

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
