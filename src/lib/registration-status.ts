/** Estados posibles de una solicitud de inscripción (jugador/equipo o socio); ver `registrations.status` en el esquema. */
export type RegistrationStatus = "pending" | "approved" | "rejected";

/** Color de badge por estado, consistente en /inscripciones, /socios (listado y detalle)
 * y en la pestaña "Inscripciones" de la ficha de persona. */
export const STATUS_VARIANT: Record<RegistrationStatus, "warning" | "secondary" | "destructive"> = {
  pending: "warning",
  approved: "secondary",
  rejected: "destructive",
};
