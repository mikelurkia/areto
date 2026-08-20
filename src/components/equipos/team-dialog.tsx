"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createTeam, updateTeam } from "@/app/[locale]/(app)/equipos/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { TEAM_CATEGORIES } from "@/components/equipos/team-categories";
import { TEAM_GENDERS } from "@/components/equipos/team-genders";

type Team = {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  minBirthYear: number | null;
  maxBirthYear: number | null;
  federationGroup: string | null;
  federationCode: string | null;
};

type TeamDialogProps =
  | { mode: "create"; seasonId: string }
  | { mode: "edit"; team: Team };

export function TeamDialog(props: TeamDialogProps) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `equipo-nuevo:${props.seasonId}`
      : `equipo:${props.team.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? createTeam : updateTeam,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

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
            {t("editTeamSr", { name: props.team.name })}
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newTeamTitle") : t("editTeamTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.team.id} />
          ) : (
            <input type="hidden" name="seasonId" value={props.seasonId} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-name">{t("nameLabel")}</FieldLabel>
              <Input
                id="team-name"
                name="name"
                defaultValue={props.mode === "edit" ? props.team.name : ""}
                placeholder={t("namePlaceholder")}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="team-category">
                  {t("categoryLabel")}
                </FieldLabel>
                <Select
                  key={
                    props.mode === "edit" ? (props.team.category ?? "none") : "none"
                  }
                  name="category"
                  defaultValue={
                    props.mode === "edit" ? (props.team.category ?? "none") : "none"
                  }
                >
                  <SelectTrigger id="team-category" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "none" ? t("categoryNone") : t(`category.${value}`)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("categoryNone")}</SelectItem>
                    {TEAM_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {t(`category.${category}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="team-gender">{t("genderLabel")}</FieldLabel>
                <Select
                  key={
                    props.mode === "edit" ? (props.team.gender ?? "none") : "none"
                  }
                  name="gender"
                  defaultValue={
                    props.mode === "edit" ? (props.team.gender ?? "none") : "none"
                  }
                >
                  <SelectTrigger id="team-gender" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "none" ? t("genderNone") : t(`gender.${value}`)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("genderNone")}</SelectItem>
                    {TEAM_GENDERS.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {t(`gender.${gender}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="team-min-birth-year">
                  {t("minBirthYearLabel")}
                </FieldLabel>
                <Input
                  id="team-min-birth-year"
                  name="minBirthYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2010"
                  defaultValue={
                    props.mode === "edit" ? (props.team.minBirthYear ?? "") : ""
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="team-max-birth-year">
                  {t("maxBirthYearLabel")}
                </FieldLabel>
                <Input
                  id="team-max-birth-year"
                  name="maxBirthYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2011"
                  defaultValue={
                    props.mode === "edit" ? (props.team.maxBirthYear ?? "") : ""
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="team-federation-group">
                  {t("federationGroupLabel")}
                </FieldLabel>
                <Input
                  id="team-federation-group"
                  name="federationGroup"
                  placeholder={t("federationGroupPlaceholder")}
                  defaultValue={
                    props.mode === "edit" ? (props.team.federationGroup ?? "") : ""
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="team-federation-code">
                  {t("federationCodeLabel")}
                </FieldLabel>
                <Input
                  id="team-federation-code"
                  name="federationCode"
                  placeholder={t("federationCodePlaceholder")}
                  defaultValue={
                    props.mode === "edit" ? (props.team.federationCode ?? "") : ""
                  }
                />
              </Field>
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
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
