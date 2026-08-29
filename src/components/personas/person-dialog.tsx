"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createPerson, updatePerson } from "@/app/[locale]/(app)/personas/actions";
import { MatchSelect } from "@/components/match-select";
import { MaskedIbanInput } from "@/components/masked-iban";
import {
  GuardianPicker,
  type GuardianOption,
} from "@/components/personas/guardian-picker";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

/** Igual que `PERSON_DIFF_FIELDS` de la revisión de inscripciones: campos que
 * se comparan al ofrecer vincular con una persona ya existente. */
const PERSON_MATCH_DIFF_FIELDS = [
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

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  nationalId: string | null;
  isMember: boolean;
  memberNumber: number | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  iban: string | null;
  guardians: { id: string; firstName: string; lastName: string }[];
  shirtSize: string | null;
  pantsSize: string | null;
  shoeSize: string | null;
  notes: string | null;
};


type PersonDialogProps = (
  | { mode: "create"; canManageBanking: boolean }
  | { mode: "edit"; person: Person; photoUrl: string | null; canManageBanking: boolean }
);

export function PersonDialog(props: PersonDialogProps) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(props.mode === "create" ? "persona-nueva" : `persona:${props.person.id}`);
  const [state, formAction] = useActionState(
    props.mode === "create" ? createPerson : updatePerson,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const person = useFrozenWhileOpen(open, props.mode === "edit" ? props.person : null);
  const photoUrl = useFrozenWhileOpen(
    open,
    props.mode === "edit" ? props.photoUrl : null,
  );
  // Los tutores se guardan como objetos y no como ids: la lista ya no se
  // recibe entera, se busca, así que el nombre tiene que viajar con la
  // selección para poder pintarlo.
  const [guardians, setGuardians] = useState<GuardianOption[]>(
    props.mode === "edit" ? props.person.guardians : [],
  );
  // Un menor no puede ser titular de un mandato SEPA: si hay tutores, el
  // principal (el primero de la lista) dispone del iban de esta persona.
  const hasGuardians = guardians.length > 0;
  const payerGuardian = guardians[0];

  // Solo al crear: si `createPerson` encontró a alguien parecido, pide
  // confirmar "vincular con esta persona" o "crear de todas formas" antes de
  // seguir — mismo mecanismo que la revisión de inscripciones.
  const pendingCandidates = props.mode === "create" ? state.candidates : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("action")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editPersonSr", { name: `${person!.firstName} ${person!.lastName}` })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newPersonTitle") : t("editPersonTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {person ? <input type="hidden" name="id" value={person.id} /> : null}
          <div className="max-h-[65vh] overflow-y-auto px-1">
            <FieldGroup>
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("personalDataSection")}
              </h2>
              <Field>
                <FieldLabel htmlFor="person-photo">{t("photoLabel")}</FieldLabel>
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
                    <AvatarFallback>
                      <UserRoundIcon className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <Input
                    id="person-photo"
                    name="photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </div>
                {photoUrl ? (
                  <Field orientation="horizontal" className="mt-1">
                    <Checkbox id="person-remove-photo" name="removePhoto" />
                    <Label htmlFor="person-remove-photo" className="font-normal">
                      {t("removePhotoLabel")}
                    </Label>
                  </Field>
                ) : null}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="person-first-name">
                    {t("firstNameLabel")}
                  </FieldLabel>
                  <Input
                    id="person-first-name"
                    name="firstName"
                    defaultValue={person?.firstName ?? ""}
                    placeholder={t("firstNamePlaceholder")}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-last-name">
                    {t("lastNameLabel")}
                  </FieldLabel>
                  <Input
                    id="person-last-name"
                    name="lastName"
                    defaultValue={person?.lastName ?? ""}
                    placeholder={t("lastNamePlaceholder")}
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="person-email">{t("emailLabel")}</FieldLabel>
                  <Input
                    id="person-email"
                    name="email"
                    type="email"
                    defaultValue={person?.email ?? ""}
                    placeholder={t("emailPlaceholder")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-phone">{t("phoneLabel")}</FieldLabel>
                  <Input
                    id="person-phone"
                    name="phone"
                    type="tel"
                    defaultValue={person?.phone ?? ""}
                    placeholder={t("phonePlaceholder")}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="person-birth-date">
                    {t("birthDateLabel")}
                  </FieldLabel>
                  <Input
                    id="person-birth-date"
                    name="birthDate"
                    type="date"
                    defaultValue={person?.birthDate ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-national-id">
                    {t("nationalIdLabel")}
                  </FieldLabel>
                  <Input
                    id="person-national-id"
                    name="nationalId"
                    defaultValue={person?.nationalId ?? ""}
                    placeholder={t("nationalIdPlaceholder")}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="person-address">
                  {t("addressLabel")}
                </FieldLabel>
                <Input
                  id="person-address"
                  name="address"
                  defaultValue={person?.address ?? ""}
                  placeholder={t("addressPlaceholder")}
                />
              </Field>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <Field>
                  <FieldLabel htmlFor="person-postal-code">
                    {t("postalCodeLabel")}
                  </FieldLabel>
                  <Input
                    id="person-postal-code"
                    name="postalCode"
                    inputMode="numeric"
                    defaultValue={person?.postalCode ?? ""}
                    placeholder={t("postalCodePlaceholder")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-city">{t("cityLabel")}</FieldLabel>
                  <Input
                    id="person-city"
                    name="city"
                    defaultValue={person?.city ?? ""}
                    placeholder={t("cityPlaceholder")}
                  />
                </Field>
              </div>

              <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("guardianshipSection")}
              </h2>
              <Field>
                <FieldLabel htmlFor="person-guardian">
                  {t("guardianLabel")}
                </FieldLabel>
                <GuardianPicker
                  value={guardians}
                  onValueChange={setGuardians}
                  excludePersonId={person?.id}
                />
                <p className="text-xs text-muted-foreground">{t("guardianMinorExcludedHint")}</p>
              </Field>

              {hasGuardians || props.canManageBanking ? (
                <>
                  <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("feeCollectionSection")}
                  </h2>
                  {hasGuardians ? (
                    <Field>
                      <FieldLabel>{t("ibanLabel")}</FieldLabel>
                      <p className="text-sm text-muted-foreground">
                        {payerGuardian
                          ? t("ibanHandledByGuardian", {
                              name: `${payerGuardian.firstName} ${payerGuardian.lastName}`,
                            })
                          : t("ibanHandledByGuardianGeneric")}
                      </p>
                    </Field>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor="person-iban">{t("ibanLabel")}</FieldLabel>
                      <MaskedIbanInput
                        id="person-iban"
                        name="iban"
                        defaultValue={person?.iban ?? ""}
                        placeholder={t("ibanPlaceholder")}
                      />
                    </Field>
                  )}
                </>
              ) : (
                // Sin `personas.banking.manage`: el campo no se pinta, pero se
                // conserva el IBAN actual como oculto — si no, guardar el resto
                // de la ficha lo borraría (`readPersonFields` lee "" si falta).
                <input type="hidden" name="iban" value={person?.iban ?? ""} />
              )}
              <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("sportsDataSection")}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="person-shirt-size">
                    {t("shirtSizeLabel")}
                  </FieldLabel>
                  <Input
                    id="person-shirt-size"
                    name="shirtSize"
                    defaultValue={person?.shirtSize ?? ""}
                    placeholder="M"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-pants-size">
                    {t("pantsSizeLabel")}
                  </FieldLabel>
                  <Input
                    id="person-pants-size"
                    name="pantsSize"
                    defaultValue={person?.pantsSize ?? ""}
                    placeholder="M"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-shoe-size">
                    {t("shoeSizeLabel")}
                  </FieldLabel>
                  <Input
                    id="person-shoe-size"
                    name="shoeSize"
                    defaultValue={person?.shoeSize ?? ""}
                    placeholder="42"
                  />
                </Field>
              </div>

              <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("memberStatusSection")}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="person-member-number">
                    {t("memberNumberLabel")}
                  </FieldLabel>
                  <Input
                    id="person-member-number"
                    name="memberNumber"
                    type="number"
                    min={1}
                    defaultValue={person?.memberNumber ?? ""}
                    placeholder={t("memberNumberPlaceholder")}
                  />
                </Field>
                <Field orientation="horizontal" className="self-end pb-2">
                  <Checkbox
                    id="person-is-member"
                    name="isMember"
                    defaultChecked={person ? person.isMember : true}
                  />
                  <Label htmlFor="person-is-member" className="font-normal">
                    {t("isMemberLabel")}
                  </Label>
                </Field>
              </div>

              <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("otherSection")}
              </h2>
              <Field>
                <FieldLabel htmlFor="person-notes">{t("notesLabel")}</FieldLabel>
                <Textarea
                  id="person-notes"
                  name="notes"
                  defaultValue={person?.notes ?? ""}
                  placeholder={t("notesPlaceholder")}
                />
              </Field>

              {pendingCandidates && pendingCandidates.length > 0 ? (
                <Alert variant="warning" className="gap-2">
                  <AlertTitle>{t("duplicateCandidatesTitle")}</AlertTitle>
                  <AlertDescription>
                    {t("duplicateCandidatesDescription")}
                  </AlertDescription>
                  <MatchSelect
                    name="linkPersonId"
                    candidates={pendingCandidates}
                    placeholder={t("duplicateMatchLabel")}
                    newValues={state.submittedFields ?? {}}
                    diffFields={PERSON_MATCH_DIFF_FIELDS}
                    keepPrefix="person"
                  />
                </Alert>
              ) : null}
            </FieldGroup>
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>
              {props.mode === "edit"
                ? t("saveChanges")
                : pendingCandidates && pendingCandidates.length > 0
                  ? t("confirmCreateAction")
                  : t("action")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
