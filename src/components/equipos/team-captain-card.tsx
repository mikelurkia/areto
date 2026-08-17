"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { updateTeamCaptain } from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";

/** Equipo sin capitán: `Select` de Base UI necesita un valor no vacío. */
const NONE = "none";

export type TeamCaptainOption = { membershipId: string; name: string };

/**
 * Designación del capitán. Es del equipo, no de la persona (el brazalete es
 * único), así que se elige aquí sobre la plantilla y no en el diálogo de cada
 * jugador: así se ve de un vistazo quién lo lleva y no hay forma de acabar con
 * dos capitanes.
 *
 * Va como control en línea dentro de la barra de acciones de la plantilla (sin
 * tarjeta ni texto de ayuda visible: la explicación queda en el `title`) para
 * no robar alto a la tabla.
 */
export function TeamCaptainCard({
  teamId,
  players,
  captainMembershipId,
}: {
  teamId: string;
  players: readonly TeamCaptainOption[];
  captainMembershipId: string | null;
}) {
  const t = useTranslations("Equipos");
  const [state, formAction] = useActionState(updateTeamCaptain, {});
  useActionToast(state);

  // El `Select` es controlado: la tarjeta sigue montada cuando el server action
  // revalida la página, así que un `defaultValue` cambiante haría saltar el
  // aviso de Base UI. Al llegar un capitán distinto del servidor se adopta
  // ajustando el estado en render (patrón recomendado de React, sin efecto).
  const [value, setValue] = useState(captainMembershipId ?? NONE);
  const [syncedCaptainId, setSyncedCaptainId] = useState(captainMembershipId);
  if (captainMembershipId !== syncedCaptainId) {
    setSyncedCaptainId(captainMembershipId);
    setValue(captainMembershipId ?? NONE);
  }

  const nameFor = (membershipId: string) =>
    players.find((p) => p.membershipId === membershipId)?.name ?? t("captainNone");

  const isDirty = value !== (captainMembershipId ?? NONE);

  return (
    <form
      action={formAction}
      className="mr-auto flex flex-wrap items-center gap-2 print:hidden"
    >
      <input type="hidden" name="teamId" value={teamId} />
      <label
        htmlFor="team-captain"
        className="text-sm text-muted-foreground"
        title={t("captainHint")}
      >
        {t("captainLabel")}
      </label>
      <Select<string>
        name="captainMembershipId"
        value={value}
        onValueChange={(next) => setValue(next ?? NONE)}
      >
        <SelectTrigger id="team-captain" size="sm" className="w-48">
          <SelectValue>
            {(value: string) => (value === NONE ? t("captainNone") : nameFor(value))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("captainNone")}</SelectItem>
          {players.map((player) => (
            <SelectItem key={player.membershipId} value={player.membershipId}>
              {player.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* El botón solo aparece cuando hay algo que guardar. */}
      {isDirty ? (
        <SubmitButton variant="outline" size="sm">
          {t("saveChanges")}
        </SubmitButton>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
