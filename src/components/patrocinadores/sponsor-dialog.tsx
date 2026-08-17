"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createSponsor, updateSponsor } from "@/app/[locale]/(app)/patrocinadores/actions";
import { SubmitButton } from "@/components/submit-button";
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
import { ContactPersonCombobox } from "@/components/patrocinadores/contact-person-combobox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

type Sponsor = {
  id: string;
  name: string;
  contactPersonId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  fiscalName: string | null;
  taxId: string | null;
  fiscalAddress: string | null;
  notes: string | null;
};

type PersonOption = { id: string; firstName: string; lastName: string };

type SponsorDialogProps = (
  | { mode: "create" }
  | { mode: "edit"; sponsor: Sponsor; logoUrl: string | null }
) & { personOptions: PersonOption[] };

export function SponsorDialog(props: SponsorDialogProps) {
  const t = useTranslations("Patrocinadores");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? "patrocinador-nuevo"
      : `patrocinador:${props.sponsor.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? createSponsor : updateSponsor,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const sponsor = useFrozenWhileOpen(open, props.mode === "edit" ? props.sponsor : null);
  const logoUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.logoUrl : null);

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
          <span className="sr-only">{t("editSponsorSr", { name: sponsor!.name })}</span>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newSponsorTitle") : t("editSponsorTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {sponsor ? <input type="hidden" name="id" value={sponsor.id} /> : null}
          <div className="max-h-[65vh] overflow-y-auto px-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="sponsor-logo">{t("logoLabel")}</FieldLabel>
                <div className="flex items-center gap-3">
                  <div className="flex size-14 items-center justify-center rounded border bg-muted/30 p-1.5">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <Input
                    id="sponsor-logo"
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </div>
                {logoUrl ? (
                  <Field orientation="horizontal" className="mt-1">
                    <Checkbox id="sponsor-remove-logo" name="removeLogo" />
                    <Label htmlFor="sponsor-remove-logo" className="font-normal">
                      {t("removeLogoLabel")}
                    </Label>
                  </Field>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="sponsor-name">{t("sponsorNameLabel")}</FieldLabel>
                <Input
                  id="sponsor-name"
                  name="name"
                  defaultValue={sponsor?.name ?? ""}
                  placeholder={t("sponsorNamePlaceholder")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sponsor-contact-person">
                  {t("contactPersonLabel")}
                </FieldLabel>
                <ContactPersonCombobox
                  key={sponsor?.id ?? "new"}
                  personOptions={props.personOptions}
                  defaultPersonId={sponsor?.contactPersonId ?? null}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="sponsor-contact-email">
                    {t("contactEmailLabel")}
                  </FieldLabel>
                  <Input
                    id="sponsor-contact-email"
                    name="contactEmail"
                    type="email"
                    defaultValue={sponsor?.contactEmail ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sponsor-contact-phone">
                    {t("contactPhoneLabel")}
                  </FieldLabel>
                  <Input
                    id="sponsor-contact-phone"
                    name="contactPhone"
                    type="tel"
                    defaultValue={sponsor?.contactPhone ?? ""}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="sponsor-website">{t("websiteLabel")}</FieldLabel>
                <Input
                  id="sponsor-website"
                  name="websiteUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  defaultValue={sponsor?.websiteUrl ?? ""}
                />
              </Field>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("fiscalSection")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="sponsor-fiscal-name">
                    {t("fiscalNameLabel")}
                  </FieldLabel>
                  <Input
                    id="sponsor-fiscal-name"
                    name="fiscalName"
                    defaultValue={sponsor?.fiscalName ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sponsor-tax-id">{t("taxIdLabel")}</FieldLabel>
                  <Input
                    id="sponsor-tax-id"
                    name="taxId"
                    defaultValue={sponsor?.taxId ?? ""}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="sponsor-fiscal-address">
                  {t("fiscalAddressLabel")}
                </FieldLabel>
                <Input
                  id="sponsor-fiscal-address"
                  name="fiscalAddress"
                  defaultValue={sponsor?.fiscalAddress ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sponsor-notes">{t("notesLabel")}</FieldLabel>
                <Textarea
                  id="sponsor-notes"
                  name="notes"
                  defaultValue={sponsor?.notes ?? ""}
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
