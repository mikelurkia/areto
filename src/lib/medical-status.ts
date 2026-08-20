/** Ventana de aviso antes de la caducidad, igual que en `/personas` y el panel del dashboard. */
export const MEDICAL_EXPIRY_WINDOW_DAYS = 60;

export type MedicalCertStatus = "expired" | "expiring" | "ok" | "missing" | "exempt";

/**
 * Estado de un certificado médico (`persons.medicalCertUntil`) frente a hoy y
 * la ventana de aviso. `today`/`cutoff` se pasan ya calculados para no repetir
 * `Date` por cada persona de un listado. `requiresCheckup` es `false` cuando
 * ninguno de los equipos activos de la persona exige reconocimiento médico
 * (`teams.requiresMedicalCheckup`): en ese caso el estado es "exempt", sin
 * importar si tiene o no una fecha registrada.
 */
export function medicalCertStatus(
  medicalCertUntil: string | null,
  today: string,
  cutoff: string,
  requiresCheckup: boolean,
): MedicalCertStatus {
  if (!requiresCheckup) return "exempt";
  if (medicalCertUntil === null) return "missing";
  if (medicalCertUntil < today) return "expired";
  if (medicalCertUntil <= cutoff) return "expiring";
  return "ok";
}
