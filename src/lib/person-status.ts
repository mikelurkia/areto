import type { LucideIcon } from "lucide-react";
import {
  CameraOffIcon,
  GraduationCapIcon,
  StethoscopeIcon,
  UserXIcon,
} from "lucide-react";

import type { TeamCategoryValue } from "@/components/equipos/team-categories";
import { categoryRequiresMedicalCheckup } from "@/components/equipos/team-categories";
import { isMinor } from "@/lib/age";
import { MEDICAL_EXPIRY_WINDOW_DAYS, medicalCertStatus } from "@/lib/medical-status";
import type { StatusTone } from "@/lib/status-tone";

/**
 * Los avisos de una persona, con su tono.
 *
 * El listado ya podía *filtrar* por «documentación pendiente», «caduca pronto»
 * o «menor sin tutor», pero las filas que devolvían esos filtros eran idénticas
 * a cualquier otra: no se veía por qué estaban ahí.
 *
 * Aquí no se inventa ninguna regla: el estado del certificado sale de
 * `medicalCertStatus` —con su ventana y su noción de equipo exento— y la
 * exención, de `categoryRequiresMedicalCheckup`, que es el criterio que ya
 * usan el panel del dashboard (`dashboard-alerts.ts:73`) y la salud de
 * plantilla. Sin esa parte, cualquier benjamín sin reconocimiento saldría
 * marcado en rojo aunque su categoría no lo exija.
 *
 * Vive fuera de `person-list.ts` a propósito: aquel es `server-only` —lleva la
 * conexión a la base de datos— y esto lo necesita la tabla, que es de cliente.
 */

/**
 * Ventana de «caduca pronto» del listado, compartida con el `WHERE` del filtro
 * (`person-list.ts`). Es la de las titulaciones; la del certificado médico la
 * pone `MEDICAL_EXPIRY_WINDOW_DAYS`, que es la que usa el resto de la
 * aplicación para lo mismo.
 */
export const EXPIRY_WINDOW_DAYS = 30;

export type PersonAlert =
  | "minorWithoutGuardian"
  | "medicalMissing"
  | "medicalExpired"
  | "medicalSoon"
  | "qualificationSoon"
  | "photoConsentMissing";

export const ALERT_TONE: Record<PersonAlert, StatusTone> = {
  minorWithoutGuardian: "danger",
  medicalExpired: "danger",
  medicalMissing: "warning",
  medicalSoon: "warning",
  qualificationSoon: "warning",
  photoConsentMissing: "warning",
};

/**
 * Icono de cada aviso, para pintarlo en el listado sin gastar una línea por
 * fila. El icono dice de qué va el aviso y el tono, cómo de grave es: por eso
 * los tres estados del certificado médico comparten icono y solo cambian de
 * color. El texto exacto lo da el `title` de la celda.
 */
export const ALERT_ICON: Record<PersonAlert, LucideIcon> = {
  minorWithoutGuardian: UserXIcon,
  medicalExpired: StethoscopeIcon,
  medicalMissing: StethoscopeIcon,
  medicalSoon: StethoscopeIcon,
  qualificationSoon: GraduationCapIcon,
  photoConsentMissing: CameraOffIcon,
};

type AlertInput = {
  birthDate: string | null;
  medicalCertUntil: string | null;
  photoConsent: boolean;
  guardians: unknown[];
  qualifications: { expiresOn: string | null }[];
  memberships: {
    team: { category: TeamCategoryValue | null; season: { isCurrent: boolean } };
  }[];
  isPastMember: boolean;
};

/** `YYYY-MM-DD` de hoy y del final de una ventana, para comparar como texto. */
export function expiryBounds(windowDays: number, today: Date = new Date()) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + windowDays);
  return {
    today: today.toISOString().slice(0, 10),
    cutoff: cutoff.toISOString().slice(0, 10),
  };
}

/**
 * Qué avisos tiene esta persona, en orden de gravedad.
 *
 * Quien ya no está en el club no genera ninguno: es la misma regla que aplica
 * `notPastMember` en la consulta, y la razón de que `isPastMember` exista
 * (`membership.ts`). Sin ella, cada persona que pasó por el club arrastraría
 * para siempre un aviso de reconocimiento caducado.
 */
export function personAlerts(person: AlertInput, today: Date = new Date()): PersonAlert[] {
  if (person.isPastMember) return [];

  const alerts: PersonAlert[] = [];

  if (isMinor(person.birthDate, today) && person.guardians.length === 0) {
    alerts.push("minorWithoutGuardian");
  }

  const requiresCheckup = person.memberships.some(
    (m) => m.team.season.isCurrent && categoryRequiresMedicalCheckup(m.team.category),
  );
  const medical = expiryBounds(MEDICAL_EXPIRY_WINDOW_DAYS, today);
  const status = medicalCertStatus(
    person.medicalCertUntil,
    medical.today,
    medical.cutoff,
    requiresCheckup,
  );
  if (status === "missing") alerts.push("medicalMissing");
  else if (status === "expired") alerts.push("medicalExpired");
  else if (status === "expiring") alerts.push("medicalSoon");

  const qualification = expiryBounds(EXPIRY_WINDOW_DAYS, today);
  const qualificationSoon = person.qualifications.some(
    (q) => q.expiresOn !== null && q.expiresOn <= qualification.cutoff,
  );
  if (qualificationSoon) alerts.push("qualificationSoon");

  if (!person.photoConsent) alerts.push("photoConsentMissing");

  return alerts;
}
