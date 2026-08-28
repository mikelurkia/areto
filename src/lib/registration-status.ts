import type { StatusTone } from "@/lib/status-tone";

/** Estados posibles de una solicitud de inscripción (jugador/equipo o socio); ver `registrations.status` en el esquema. */
export type RegistrationStatus = "pending" | "approved" | "rejected";

/** Tono por estado, consistente en /inscripciones, /socios (listado y detalle)
 * y en la pestaña "Inscripciones" de la ficha de persona. */
export const STATUS_TONE: Record<RegistrationStatus, StatusTone> = {
  pending: "warning",
  approved: "positive",
  rejected: "danger",
};
