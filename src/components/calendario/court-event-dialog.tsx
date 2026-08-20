"use client";

import { useActionState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createCourtEvent, updateCourtEvent } from "@/app/[locale]/(app)/calendario/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { PREFERRED_DAYS } from "@/components/calendario/preferred-days";

type TeamOption = { id: string; name: string };

type CourtEventEditable = {
  id: string;
  teamId: string;
  teamName: string;
  weekendOf: string;
  isHome: boolean | null;
  opponent: string | null;
  preferredDay: string | null;
  notes: string | null;
};

type CourtEventDialogProps =
  | {
      mode: "create";
      teams: TeamOption[];
      /** Prefija la fecha del formulario (p. ej. al crear desde una celda del
       * calendario de mes). */
      defaultWeekendOf?: string;
      /** Clave única del diálogo en la URL (`?dialogo=`). Necesaria cuando hay
       * varias instancias en modo "create" a la vez (una por celda vacía del
       * calendario de mes): sin ella, todas compartirían la clave fija
       * "partido-nuevo" y se abrirían simultáneamente. La tabla de lista, que
       * solo tiene una instancia, no necesita pasarla. */
      dialogKey?: string;
      /** Elemento que actúa de disparador del diálogo, sustituyendo al botón
       * por defecto (p. ej. un badge de partido en el calendario de mes). */
      triggerRender?: React.ReactElement;
      triggerChildren?: React.ReactNode;
    }
  | {
      mode: "edit";
      teams: TeamOption[];
      event: CourtEventEditable;
      triggerRender?: React.ReactElement;
      triggerChildren?: React.ReactNode;
    };

export function CourtEventDialog(props: CourtEventDialogProps) {
  const t = useTranslations("Calendario");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? (props.dialogKey ?? "partido-nuevo")
      : `partido:${props.event.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? createCourtEvent : updateCourtEvent,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger
          render={props.triggerRender ?? <Button />}
          nativeButton={props.triggerRender == null}
        >
          {props.triggerChildren ?? (
            <>
              <PlusIcon data-icon="inline-start" />
              {t("action")}
            </>
          )}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={props.triggerRender ?? <Button variant="ghost" size="icon-sm" />}
          nativeButton={props.triggerRender == null}
        >
          {props.triggerChildren ?? (
            <>
              <PencilIcon />
              <span className="sr-only">
                {t("editMatchSr", { team: props.event.teamName })}
              </span>
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newMatchTitle") : t("editMatchTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.event.id} />
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="court-event-team">{t("teamLabel")}</FieldLabel>
              <Select
                key={props.mode === "edit" ? props.event.teamId : "create"}
                name="teamId"
                defaultValue={props.mode === "edit" ? props.event.teamId : undefined}
              >
                <SelectTrigger id="court-event-team" className="w-full">
                  <SelectValue>
                    {(value: string) => props.teams.find((tm) => tm.id === value)?.name ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {props.teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="court-event-weekend">{t("weekendLabel")}</FieldLabel>
                <Input
                  id="court-event-weekend"
                  name="weekendOf"
                  type="date"
                  defaultValue={
                    props.mode === "edit" ? props.event.weekendOf : (props.defaultWeekendOf ?? "")
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="court-event-home-away">{t("homeAwayLabel")}</FieldLabel>
                <Select
                  key={
                    props.mode === "edit"
                      ? props.event.isHome
                        ? "home"
                        : "away"
                      : "create"
                  }
                  name="isHome"
                  defaultValue={
                    props.mode === "edit"
                      ? props.event.isHome
                        ? "home"
                        : "away"
                      : undefined
                  }
                >
                  <SelectTrigger id="court-event-home-away" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "home" ? t("homeOption") : t("awayOption")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">{t("homeOption")}</SelectItem>
                    <SelectItem value="away">{t("awayOption")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="court-event-opponent">{t("opponentLabel")}</FieldLabel>
              <Input
                id="court-event-opponent"
                name="opponent"
                placeholder={t("opponentPlaceholder")}
                defaultValue={props.mode === "edit" ? (props.event.opponent ?? "") : ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="court-event-preferred-day">
                {t("preferredDayLabel")}
              </FieldLabel>
              <Select
                key={
                  props.mode === "edit" ? (props.event.preferredDay ?? "none") : "none"
                }
                name="preferredDay"
                defaultValue={
                  props.mode === "edit" ? (props.event.preferredDay ?? "none") : "none"
                }
              >
                <SelectTrigger id="court-event-preferred-day" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === "none" ? t("preferredDayNone") : t(`preferredDay.${value}`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("preferredDayNone")}</SelectItem>
                  {PREFERRED_DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {t(`preferredDay.${day}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="court-event-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="court-event-notes"
                name="notes"
                placeholder={t("notesPlaceholder")}
                defaultValue={props.mode === "edit" ? (props.event.notes ?? "") : ""}
              />
            </Field>
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
