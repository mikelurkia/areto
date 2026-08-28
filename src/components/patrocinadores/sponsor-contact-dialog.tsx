"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addSponsorContact,
  updateSponsorContact,
} from "@/app/[locale]/(app)/patrocinadores/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

type SponsorContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type SponsorContactDialogProps =
  | { mode: "create"; sponsorId: string }
  | { mode: "edit"; contact: SponsorContact };

export function SponsorContactDialog(props: SponsorContactDialogProps) {
  const t = useTranslations("Patrocinadores");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `contacto-nuevo:${props.sponsorId}`
      : `contacto:${props.contact.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? addSponsorContact : updateSponsorContact,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const contact = useFrozenWhileOpen(open, props.mode === "edit" ? props.contact : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button size="sm" />}>
          <PlusIcon data-icon="inline-start" />
          {t("addContactAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editContactSr")}</span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newContactTitle") : t("editContactTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="sponsorId" value={props.sponsorId} />
          ) : (
            <input type="hidden" name="id" value={contact!.id} />
          )}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="contact-name">{t("contactNameLabel")}</FieldLabel>
                <Input
                  id="contact-name"
                  name="name"
                  defaultValue={contact?.name ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-role">{t("contactRoleLabel")}</FieldLabel>
                <Input
                  id="contact-role"
                  name="role"
                  defaultValue={contact?.role ?? ""}
                  placeholder={t("contactRolePlaceholder")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="contact-email">{t("contactEmailLabel")}</FieldLabel>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  defaultValue={contact?.email ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-phone">{t("contactPhoneLabel")}</FieldLabel>
                <Input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  defaultValue={contact?.phone ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="contact-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="contact-notes"
                name="notes"
                defaultValue={contact?.notes ?? ""}
              />
            </Field>
          </FieldGroup>
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>
              {props.mode === "create" ? t("addContactAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
