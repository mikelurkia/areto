"use client";

import { useActionState, useState, useTransition } from "react";

import { setMembershipFederationRegistered } from "@/app/[locale]/(app)/temporadas/actions";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Casilla de "jugador inscrito en la plataforma federativa" para una membership.
 * Alimenta el rollup del trámite `alta_jugadores_plataforma`. Optimista y
 * despacha la acción con un FormData construido a mano.
 */
export function FederationToggle({
  membershipId,
  registered,
  label,
}: {
  membershipId: string;
  registered: boolean;
  label: string;
}) {
  const [, action] = useActionState(setMembershipFederationRegistered, {});
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useState(registered);
  const [prev, setPrev] = useState(registered);

  // Reconcilia en render si el valor del servidor cambia por revalidación.
  if (registered !== prev) {
    setPrev(registered);
    setChecked(registered);
  }

  function onChange(next: boolean) {
    setChecked(next);
    const formData = new FormData();
    formData.set("id", membershipId);
    if (next) formData.set("registered", "on");
    startTransition(() => action(formData));
  }

  return (
    <Checkbox checked={checked} onCheckedChange={onChange} aria-label={label} />
  );
}
