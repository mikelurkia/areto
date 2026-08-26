"use client";

import { useActionState, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  saveInjuryReportAndGenerate,
  type PersonState,
} from "@/app/[locale]/(app)/personas/actions";
import { useRouter } from "@/i18n/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";

const initialState: PersonState = {};

/**
 * Valor de los `<select>` para "sin especificar". No se usa la cadena vacía
 * porque el Select la interpreta como "nada seleccionado" y no la puede tener
 * como opción elegible. La acción del servidor descarta cualquier valor que no
 * esté en el enum, así que este centinela nunca llega a la base de datos.
 */
const UNSET = "-";

export type InjuryReportValues = {
  id: string;
  notes: string | null;
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
 * Lanza la descarga del fichero recién generado sin sacar al usuario de la
 * página. El `href` apunta al proxy de Storage, que es del mismo origen: por
 * eso el atributo `download` se respeta y manda el PDF a la carpeta de
 * descargas en vez de abrirlo en una pestaña.
 */
function startDownload({ url, filename }: { url: string; filename: string }) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Ficha completa del parte de lesión: las casillas del impreso oficial de la
 * Mutualidad y las notas internas, en un único formulario que guarda y
 * regenera el fichero del parte de una vez. `report` es `null` en el alta:
 * entonces el envío crea el parte —con la fecha de hoy, que no se pide aquí—
 * y redirige a su URL definitiva. Solo cubre la mitad del impreso que rellena
 * el club: la HISTORIA CLÍNICA la escribe a mano el médico sobre el papel,
 * porque la plantilla oficial no tiene campos editables ahí.
 */
export function InjuryReportForm({
  personId,
  report,
  teams,
}: {
  personId: string;
  report: InjuryReportValues | null;
  teams: { id: string; name: string }[];
}) {
  const t = useTranslations("Personas");
  const router = useRouter();
  const [state, action] = useActionState(saveInjuryReportAndGenerate, initialState);
  useActionToast(state);

  // Guardar deja el parte generado y bajado en un solo gesto. En el alta, la
  // navegación a la URL definitiva la hace el cliente (ver `redirectTo` en la
  // acción) y va después de disparar la descarga, que ya está en marcha y no la
  // corta una navegación de cliente.
  useActionResult(
    state,
    useCallback(
      (result: PersonState) => {
        if (result.download) startDownload(result.download);
        if (result.redirectTo) router.replace(result.redirectTo);
      },
      [router],
    ),
  );

  const tristate = (value: boolean | null | undefined) =>
    value === true ? "yes" : value === false ? "no" : UNSET;

  return (
    <form action={action}>
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="id" value={report?.id ?? ""} />
      <FieldGroup>
        <Choice
          id="injury-teamId"
          name="teamId"
          label={t("injuryReportTeamLabel")}
          // Viene elegido de antemano: en un parte nuevo, el equipo del jugador
          // esta temporada (`teams` llega ordenado por la página). Es el dato
          // que casi nunca hay que cambiar, y no tiene opción "sin equipo"
          // porque sin ficha federativa no hay parte que tramitar.
          defaultValue={report?.teamId ?? teams[0]?.id ?? UNSET}
          allowUnset={false}
          unsetLabel={t("injuryReportTeamPlaceholder")}
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
              defaultValue={report?.reportedPlace ?? ""}
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
              defaultValue={report?.reportedOn ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="injury-place"
            name="place"
            label={t("injuryReportPlaceLabel")}
            defaultValue={report?.place ?? UNSET}
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
              defaultValue={report?.placeOther ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="injury-matchMinute"
            name="matchMinute"
            label={t("injuryReportMinuteLabel")}
            defaultValue={report?.matchMinute ?? UNSET}
            unsetLabel={t("injuryReportUnspecifiedOption")}
            options={MINUTES.map((value) => ({ value, label: value }))}
          />
          <Choice
            id="injury-surface"
            name="surface"
            label={t("injuryReportSurfaceLabel")}
            defaultValue={report?.surface ?? "other"}
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
              defaultValue={report?.opponentTeam ?? ""}
            />
          </Field>
          <Choice
            id="injury-collision"
            name="collision"
            label={t("injuryReportCollisionLabel")}
            defaultValue={tristate(report?.collision)}
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
            defaultValue={tristate(report?.relatedToPrevious)}
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
            defaultValue={report?.bootType ?? "other"}
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
            defaultValue={report?.trainingSurface ?? "other"}
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
              defaultValue={report?.weeklyTrainingMinutes ?? 150}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="injury-report-notes">{t("notesLabel")}</FieldLabel>
          <Textarea id="injury-report-notes" name="notes" defaultValue={report?.notes ?? ""} />
        </Field>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">
          {report ? t("injuryReportSaveAction") : t("injuryReportCreateAction")}
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

/**
 * Select con una opción "sin especificar" al principio, que es el caso normal
 * mientras el parte se está completando. Con `allowUnset={false}` esa opción
 * deja de ofrecerse —el campo es obligatorio— y `unsetLabel` pasa a ser solo el
 * texto del hueco, para el caso raro de que el valor guardado ya no esté entre
 * las opciones.
 */
function Choice({
  id,
  name,
  label,
  defaultValue,
  allowUnset = true,
  unsetLabel,
  options,
}: {
  id: string;
  name: string;
  label: ReactNode;
  defaultValue: string;
  allowUnset?: boolean;
  unsetLabel: string;
  options: { value: string; label: string }[];
}) {
  const all = allowUnset ? [{ value: UNSET, label: unsetLabel }, ...options] : options;
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
