"use client";

import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  updateInjuryReportFederationFields,
  type PersonState,
} from "@/app/[locale]/(app)/personas/actions";
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

const initialState: PersonState = {};

/**
 * Valor de los `<select>` para "sin especificar". No se usa la cadena vacía
 * porque el Select la interpreta como "nada seleccionado" y no la puede tener
 * como opción elegible. La acción del servidor descarta cualquier valor que no
 * esté en el enum, así que este centinela nunca llega a la base de datos.
 */
const UNSET = "-";

export type InjuryReportFederationValues = {
  id: string;
  teamId: string | null;
  reportedOn: string | null;
  reportedPlace: string | null;
  place: string | null;
  placeOther: string | null;
  matchMinute: string | null;
  surface: string | null;
  collision: boolean | null;
  opponentTeam: string | null;
  relatedToPrevious: boolean | null;
  bootType: string | null;
  trainingSurface: string | null;
  weeklyTrainingMinutes: number | null;
};

const MINUTES = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
const SURFACES = ["natural", "artificial", "soil", "other"];

/**
 * Casillas del parte oficial de la Mutualidad para un parte de lesión ya
 * abierto. Solo cubre la mitad que rellena el club: la HISTORIA CLÍNICA del
 * impreso la escribe a mano el médico sobre el papel, porque la plantilla
 * oficial no tiene campos editables en esa parte.
 */
export function InjuryReportFederationForm({
  report,
  teams,
}: {
  report: InjuryReportFederationValues;
  teams: { id: string; name: string }[];
}) {
  const t = useTranslations("Personas");
  const [state, action] = useActionState(updateInjuryReportFederationFields, initialState);
  useActionToast(state);

  const tristate = (value: boolean | null) =>
    value === true ? "yes" : value === false ? "no" : UNSET;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={report.id} />
      <FieldGroup>
        <Choice
          id="injury-teamId"
          name="teamId"
          label={t("injuryReportTeamLabel")}
          defaultValue={report.teamId ?? UNSET}
          unsetLabel={t("injuryReportNoTeamOption")}
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="injury-reportedPlace">
              {t("injuryReportReportedPlaceLabel")}
            </FieldLabel>
            <Input
              id="injury-reportedPlace"
              name="reportedPlace"
              defaultValue={report.reportedPlace ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="injury-reportedOn">
              {t("injuryReportReportedOnLabel")}
            </FieldLabel>
            <Input
              id="injury-reportedOn"
              name="reportedOn"
              type="date"
              defaultValue={report.reportedOn ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="injury-place"
            name="place"
            label={t("injuryReportPlaceLabel")}
            defaultValue={report.place ?? UNSET}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={["match", "training", "other"].map((value) => ({
              value,
              label: t(`injuryPlaceOption.${value}`),
            }))}
          />
          <Field>
            <FieldLabel htmlFor="injury-placeOther">
              {t("injuryReportPlaceOtherLabel")}
            </FieldLabel>
            <Input
              id="injury-placeOther"
              name="placeOther"
              defaultValue={report.placeOther ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="injury-matchMinute"
            name="matchMinute"
            label={t("injuryReportMinuteLabel")}
            defaultValue={report.matchMinute ?? UNSET}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={MINUTES.map((value) => ({ value, label: value }))}
          />
          <Choice
            id="injury-surface"
            name="surface"
            label={t("injuryReportSurfaceLabel")}
            defaultValue={report.surface ?? UNSET}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={SURFACES.map((value) => ({
              value,
              label: t(`pitchSurfaceOption.${value}`),
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="injury-opponentTeam">
              {t("injuryReportOpponentTeamLabel")}
            </FieldLabel>
            <Input
              id="injury-opponentTeam"
              name="opponentTeam"
              defaultValue={report.opponentTeam ?? ""}
            />
          </Field>
          <Choice
            id="injury-collision"
            name="collision"
            label={t("injuryReportCollisionLabel")}
            defaultValue={tristate(report.collision)}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={[
              { value: "yes", label: t("injuryReportAnswerYes") },
              { value: "no", label: t("injuryReportAnswerNo") },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="injury-relatedToPrevious"
            name="relatedToPrevious"
            label={t("injuryReportRelatedToPreviousLabel")}
            defaultValue={tristate(report.relatedToPrevious)}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={[
              { value: "yes", label: t("injuryReportAnswerYes") },
              { value: "no", label: t("injuryReportAnswerNo") },
            ]}
          />
          <Choice
            id="injury-bootType"
            name="bootType"
            label={t("injuryReportBootTypeLabel")}
            defaultValue={report.bootType ?? UNSET}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={["studs", "other"].map((value) => ({
              value,
              label: t(`bootTypeOption.${value}`),
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="injury-trainingSurface"
            name="trainingSurface"
            label={t("injuryReportTrainingSurfaceLabel")}
            defaultValue={report.trainingSurface ?? UNSET}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={SURFACES.map((value) => ({
              value,
              label: t(`pitchSurfaceOption.${value}`),
            }))}
          />
          <Field>
            <FieldLabel htmlFor="injury-weeklyTrainingMinutes">
              {t("injuryReportWeeklyMinutesLabel")}
            </FieldLabel>
            <Input
              id="injury-weeklyTrainingMinutes"
              name="weeklyTrainingMinutes"
              type="number"
              min={0}
              step={1}
              defaultValue={report.weeklyTrainingMinutes ?? ""}
            />
          </Field>
        </div>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveChanges")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}

/** Select con una opción "sin especificar" al principio, que es el caso normal
 *  mientras el parte se está completando. */
function Choice({
  id,
  name,
  label,
  defaultValue,
  unsetLabel,
  options,
}: {
  id: string;
  name: string;
  label: ReactNode;
  defaultValue: string;
  unsetLabel: string;
  options: { value: string; label: string }[];
}) {
  const all = [{ value: UNSET, label: unsetLabel }, ...options];
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {(value: string) => all.find((o) => o.value === value)?.label ?? unsetLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {all.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
