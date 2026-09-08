import type { StatusTone } from "@/lib/status-tone";

/** Estados de la inscripción de un equipo en la liga/federación; ver `teams.registrationStatus` en el esquema. */
export const TEAM_REGISTRATION_STATUSES = [
  "not_registered",
  "pending",
  "rejected",
  "registered",
] as const;

export type TeamRegistrationStatus = (typeof TEAM_REGISTRATION_STATUSES)[number];

export const STATUS_TONE: Record<TeamRegistrationStatus, StatusTone> = {
  not_registered: "neutral",
  pending: "warning",
  rejected: "danger",
  registered: "positive",
};
