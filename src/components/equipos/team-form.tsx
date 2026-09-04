"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { createTeam, updateTeam } from "@/app/[locale]/(app)/equipos/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
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
import { TEAM_CATEGORIES } from "@/components/equipos/team-categories";
import { TEAM_GENDERS } from "@/components/equipos/team-genders";
import { FEE_PERIODS } from "@/components/equipos/fee-periods";

type Team = {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  federationGroup: string | null;
  federationCode: string | null;
  playerFeeCents: number | null;
  playerFeePeriod: string;
  playerFeeNotes: string | null;
};

type TeamFormProps =
  | { mode: "create"; seasonId: string }
  | { mode: "edit"; team: Team };

/**
 * Campos de equipo, reutilizados a página completa para crear
 * (`/equipos/nuevo`) y en la pestaña Configuración de la ficha para editar.
 * Sin `Dialog` alrededor: cada sitio que lo usa pone su propia `Card`.
 */
export function TeamForm(props: TeamFormProps) {
  const t = useTranslations("Equipos");
  const [state, formAction] = useActionState(
    props.mode === "create" ? createTeam : updateTeam,
    {},
  );
  useActionToast(state);

  return (
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
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="team-player-fee">
              {t("playerFeeLabel")}
            </FieldLabel>
            <Input
              id="team-player-fee"
              name="playerFee"
              inputMode="decimal"
              placeholder={t("playerFeePlaceholder")}
              defaultValue={
                props.mode === "edit" && props.team.playerFeeCents !== null
                  ? String(props.team.playerFeeCents / 100)
                  : ""
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="team-player-fee-period">
              {t("playerFeePeriodLabel")}
            </FieldLabel>
            <Select
              key={props.mode === "edit" ? props.team.playerFeePeriod : "season"}
              name="playerFeePeriod"
              defaultValue={
                props.mode === "edit" ? props.team.playerFeePeriod : "season"
              }
            >
              <SelectTrigger id="team-player-fee-period" className="w-full">
                <SelectValue>
                  {(value: string) => t(`feePeriod.${value}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FEE_PERIODS.map((period) => (
                  <SelectItem key={period} value={period}>
                    {t(`feePeriod.${period}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="team-player-fee-notes">
            {t("playerFeeNotesLabel")}
          </FieldLabel>
          <Input
            id="team-player-fee-notes"
            name="playerFeeNotes"
            placeholder={t("playerFeeNotesPlaceholder")}
            defaultValue={
              props.mode === "edit" ? (props.team.playerFeeNotes ?? "") : ""
            }
          />
        </Field>
        <FormError message={state.error} />
        <SubmitButton className="self-start">
          {props.mode === "create" ? t("action") : t("saveChanges")}
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
