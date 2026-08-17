"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createPerson, updatePerson } from "@/app/[locale]/(app)/personas/actions";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

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
  iban: string | null;
  guardians: { id: string; firstName: string; lastName: string }[];
  medicalCertUntil: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
  shoeSize: string | null;
  photoConsent: boolean;
  sepaConsent: boolean;
  notes: string | null;
};

type PersonOption = { id: string; firstName: string; lastName: string };

type PersonDialogProps = (
  | { mode: "create" }
  | { mode: "edit"; person: Person; photoUrl: string | null }
) & { guardianOptions: PersonOption[] };

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
  const guardianOptions = props.guardianOptions.filter((p) => p.id !== person?.id);
  const [guardianIds, setGuardianIds] = useState<string[]>(
    props.mode === "edit" ? props.person.guardians.map((g) => g.id) : [],
  );

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
              <div className="grid grid-cols-2 gap-3">
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
              <Field>
                <FieldLabel htmlFor="person-guardian">
                  {t("guardianLabel")}
                </FieldLabel>
                {guardianIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {guardianIds.map((id) => {
                      const g = guardianOptions.find((o) => o.id === id);
                      if (!g) return null;
                      const name = `${g.firstName} ${g.lastName}`;
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {name}
                          <button
                            type="button"
                            onClick={() =>
                              setGuardianIds((prev) => prev.filter((x) => x !== id))
                            }
                            aria-label={t("removeGuardianSr", { name })}
                            className="rounded-full hover:bg-black/10"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                ) : null}
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !guardianIds.includes(value)) {
                      setGuardianIds((prev) => [...prev, value]);
                    }
                  }}
                >
                  <SelectTrigger id="person-guardian" className="w-full">
                    <SelectValue>{() => t("addGuardianPlaceholder")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {guardianOptions
                      .filter((g) => !guardianIds.includes(g.id))
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.firstName} {g.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="guardianIds" value={guardianIds.join(",")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="person-iban">{t("ibanLabel")}</FieldLabel>
                  <Input
                    id="person-iban"
                    name="iban"
                    defaultValue={person?.iban ?? ""}
                    placeholder={t("ibanPlaceholder")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="person-medical-cert">
                    {t("medicalCertLabel")}
                  </FieldLabel>
                  <Input
                    id="person-medical-cert"
                    name="medicalCertUntil"
                    type="date"
                    defaultValue={person?.medicalCertUntil ?? ""}
                  />
                </Field>
              </div>
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
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Field orientation="horizontal">
                  <Checkbox
                    id="person-is-member"
                    name="isMember"
                    defaultChecked={person ? person.isMember : true}
                  />
                  <Label htmlFor="person-is-member" className="font-normal">
                    {t("isMemberLabel")}
                  </Label>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="person-photo-consent"
                    name="photoConsent"
                    defaultChecked={person?.photoConsent ?? false}
                  />
                  <Label htmlFor="person-photo-consent" className="font-normal">
                    {t("photoConsentLabel")}
                  </Label>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="person-sepa-consent"
                    name="sepaConsent"
                    defaultChecked={person?.sepaConsent ?? false}
                  />
                  <Label htmlFor="person-sepa-consent" className="font-normal">
                    {t("sepaConsentLabel")}
                  </Label>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="person-notes">{t("notesLabel")}</FieldLabel>
                <Textarea
                  id="person-notes"
                  name="notes"
                  defaultValue={person?.notes ?? ""}
                  placeholder={t("notesPlaceholder")}
                />
              </Field>
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
              {props.mode === "create" ? t("action") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
