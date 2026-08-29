"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateMembershipFederationCard } from "@/app/[locale]/(app)/equipos/[teamId]/actions";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

export function MembershipFederationCardDialog({
  membershipId,
  fileUrl,
}: {
  membershipId: string;
  fileUrl: string | null;
}) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useDialogParam(`ficha-federativa:${membershipId}`);
  const [state, formAction] = useActionState(updateMembershipFederationCard, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const frozenFileUrl = useFrozenWhileOpen(open, fileUrl);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">{t("changeFederationCardSr")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("federationCardLabel")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={membershipId} />
          <Field>
            <FieldLabel htmlFor={`membership-federation-card-${membershipId}`}>
              {t("federationCardLabel")}
            </FieldLabel>
            {frozenFileUrl ? (
              <a
                href={frozenFileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <PaperclipIcon className="size-3.5" />
                {t("documentViewFile")}
              </a>
            ) : null}
            <Input
              id={`membership-federation-card-${membershipId}`}
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
            {frozenFileUrl ? (
              <Field orientation="horizontal" className="mt-1">
                <Checkbox id={`membership-federation-card-remove-${membershipId}`} name="removeFile" />
                <Label
                  htmlFor={`membership-federation-card-remove-${membershipId}`}
                  className="font-normal"
                >
                  {t("federationCardRemoveFileLabel")}
                </Label>
              </Field>
            ) : null}
          </Field>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("saveChanges")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
