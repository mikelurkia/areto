import {
  MEDICAL_EXPIRY_WINDOW_DAYS,
  medicalCertStatus,
  type MedicalCertStatus,
} from "@/lib/medical-status";

/** Rol de una persona en un equipo, tal y como lo declara `membershipRole`. */
export type MedicalPanelRole = "player" | "coach" | "staff";

/**
 * Una persona del panel médico con los equipos activos que justifican su
 * presencia. `birthDate`/`nationalId` solo los consumen las exportaciones (el
 * listado imprimible y el CSV); la tabla en pantalla no los muestra.
 */
export type MedicalPanelRow = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationalId: string | null;
  medicalCertUntil: string | null;
  teams: {
    id: string;
    name: string;
    role: MedicalPanelRole;
    requiresMedicalCheckup: boolean;
  }[];
};

export type MedicalPanelRowWithStatus = MedicalPanelRow & { status: MedicalCertStatus };

/**
 * Filtros del panel. `team`/`status` valen "all" cuando no filtran; `status`
 * admite además el agregado "needsUpdate" (caducado, por caducar o sin
 * reconocimiento), que es la vista con la que se trabaja al renovar.
 */
export type MedicalPanelFilters = {
  query: string;
  team: string;
  status: string;
};

export const EMPTY_MEDICAL_PANEL_FILTERS: MedicalPanelFilters = {
  query: "",
  team: "all",
  status: "all",
};

/**
 * Fechas de referencia en ISO `YYYY-MM-DD`, para comparar con las columnas
 * `date` de Postgres sin construir un `Date` por persona.
 */
export function medicalReferenceDates(now: Date): { today: string; cutoff: string } {
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() + MEDICAL_EXPIRY_WINDOW_DAYS);
  return {
    today: now.toISOString().slice(0, 10),
    cutoff: cutoffDate.toISOString().slice(0, 10),
  };
}

/** Estado del certificado de una fila: basta un equipo que lo exija. */
export function medicalPanelRowStatus(
  row: MedicalPanelRow,
  today: string,
  cutoff: string,
): MedicalCertStatus {
  const requiresCheckup = row.teams.some((team) => team.requiresMedicalCheckup);
  return medicalCertStatus(row.medicalCertUntil, today, cutoff, requiresCheckup);
}

/**
 * Añade el estado a cada fila y aplica los filtros del panel. Vive aquí, y no
 * dentro del componente, porque el listado imprimible tiene que reproducir en
 * servidor exactamente la misma selección que el usuario ve en pantalla.
 */
export function filterMedicalPanelRows(
  rows: MedicalPanelRow[],
  filters: MedicalPanelFilters,
  today: string,
  cutoff: string,
): MedicalPanelRowWithStatus[] {
  let result: MedicalPanelRowWithStatus[] = rows.map((row) => ({
    ...row,
    status: medicalPanelRowStatus(row, today, cutoff),
  }));

  const needle = filters.query.trim().toLowerCase();
  if (needle) {
    result = result.filter((row) =>
      `${row.firstName} ${row.lastName}`.toLowerCase().includes(needle),
    );
  }
  if (filters.team !== "all") {
    result = result.filter((row) => row.teams.some((team) => team.id === filters.team));
  }
  if (filters.status === "needsUpdate") {
    result = result.filter(
      (row) =>
        row.status === "expired" || row.status === "expiring" || row.status === "missing",
    );
  } else if (filters.status !== "all") {
    result = result.filter((row) => row.status === filters.status);
  }
  return result;
}

/** Roles distintos de la persona en la temporada activa, sin repetir. */
export function medicalPanelRowRoles(row: MedicalPanelRow): MedicalPanelRole[] {
  return [...new Set(row.teams.map((team) => team.role))];
}
