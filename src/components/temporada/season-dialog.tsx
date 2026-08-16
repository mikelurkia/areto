"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  createSeason,
  deleteSeason,
  updateSeason,
} from "@/app/[locale]/(app)/temporadas/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

type Season = {
  id: string;
  name: string;
  isCurrent: boolean;
  startsOn: string | null;
  endsOn: string | null;
};

type SeasonDialogProps = { mode: "create" } | { mode: "edit"; season: Season };

export function SeasonDialog(props: SeasonDialogProps) {
  const t = useTranslations("Temporadas");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    props.mode === "create" ? createSeason : updateSeason,
    {},
  );
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  const season = props.mode === "edit" ? props.season : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createSeason")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">
            {t("editSeasonSr", { name: season!.name })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newSeasonTitle") : t("editSeasonTitle")}
          </DialogTitle>
          {props.mode === "create" ? (
            <DialogDescription>{t("newSeasonDescription")}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form action={action}>
          {season ? <input type="hidden" name="id" value={season.id} /> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="season-name">
                {t("seasonNameLabel")}
              </FieldLabel>
              <Input
                id="season-name"
                name="name"
                defaultValue={season?.name ?? ""}
                placeholder={t("seasonNamePlaceholder")}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="season-starts-on">
                  {t("startsOnLabel")}
                </FieldLabel>
                <Input
                  id="season-starts-on"
                  name="startsOn"
                  type="date"
                  defaultValue={season?.startsOn ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="season-ends-on">
                  {t("endsOnLabel")}
                </FieldLabel>
                <Input
                  id="season-ends-on"
                  name="endsOn"
                  type="date"
                  defaultValue={season?.endsOn ?? ""}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="season-current"
                name="makeCurrent"
                defaultChecked={season ? season.isCurrent : true}
              />
              <Label htmlFor="season-current" className="font-normal">
                {t("makeCurrentLabel")}
              </Label>
            </Field>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton>
                {props.mode === "create" ? t("createSeason") : t("saveChanges")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSeasonDialog({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Temporadas");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteSeason, {});
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">{t("deleteSeasonSr", { name })}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteSeasonTitle", { name })}</DialogTitle>
          <DialogDescription>{t("deleteSeasonDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          {state.error ? (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">
              {t("deleteSeasonButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
