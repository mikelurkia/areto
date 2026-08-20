"use client";

import { useActionState } from "react";
import { PencilIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { updatePersonPhoto } from "@/app/[locale]/(app)/personas/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function PersonPhotoDialog({
  personId,
  photoUrl,
}: {
  personId: string;
  photoUrl: string | null;
}) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(`persona-foto:${personId}`);
  const [state, formAction] = useActionState(updatePersonPhoto, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const frozenPhotoUrl = useFrozenWhileOpen(open, photoUrl);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">{t("changePhotoSr")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("photoLabel")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={personId} />
          <Field>
            <FieldLabel htmlFor="person-photo-file">{t("photoLabel")}</FieldLabel>
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                {frozenPhotoUrl ? <AvatarImage src={frozenPhotoUrl} alt="" /> : null}
                <AvatarFallback>
                  <UserRoundIcon className="size-4" />
                </AvatarFallback>
              </Avatar>
              <Input
                id="person-photo-file"
                name="photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </div>
            {frozenPhotoUrl ? (
              <Field orientation="horizontal" className="mt-1">
                <Checkbox id="person-photo-remove" name="removePhoto" />
                <Label htmlFor="person-photo-remove" className="font-normal">
                  {t("removePhotoLabel")}
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
