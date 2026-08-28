import type { StatusTone } from "@/lib/status-tone";

export const SPONSORSHIP_EXPIRY_WINDOW_DAYS = 60;

/**
 * Ruta de la miniatura de un logo, junto al original en el mismo bucket
 * (`sponsorship-logos`). El logo se sube dos veces: `logo.<ext>` con la
 * calidad original (para verlo a tamaño real desde la ficha) y esta
 * miniatura, mucho más ligera, para el resto de sitios donde solo se muestra
 * como avatar pequeño (listados, muro público, vista previa al editar).
 */
export function logoThumbPath(logoPath: string): string {
  return logoPath.replace(/\/logo\.[^/]+$/, "/logo-thumb.webp");
}

/** Etiqueta de temporada a partir del año de inicio: 2026 → "2026/27". */
export function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Año de inicio de temporada de una fecha ISO (temporada sep–ago). */
export function seasonYearOf(dateIso: string): number {
  const [y, m] = dateIso.split("-").map(Number);
  return m >= 8 ? y : y - 1; // agosto+ pertenece a la temporada que empieza ese año
}

export type SponsorshipStatus = "active" | "expiringSoon" | "expired";

/** Tono por estado de patrocinio, igual en el listado y en la ficha. */
export const SPONSORSHIP_TONE: Record<SponsorshipStatus, StatusTone> = {
  active: "positive",
  expiringSoon: "warning",
  expired: "danger",
};

export function sponsorshipStatus(
  endsOn: string | null,
  today: string,
  cutoff: string,
): SponsorshipStatus {
  if (endsOn === null) return "active";
  if (endsOn < today) return "expired";
  if (endsOn <= cutoff) return "expiringSoon";
  return "active";
}

/**
 * Importe anual equivalente de un patrocinio: el importe TOTAL pactado si la
 * duración del acuerdo es menor de un año (o desconocida, por fechas
 * incompletas), o el total repartido entre los años que dura en caso
 * contrario. Se usa para sugerir el importe al dar de alta un cobro suelto.
 */
export function annualEquivalentCents(
  totalAmountCents: number,
  startsOn: string | null,
  endsOn: string | null,
): number {
  if (!startsOn || !endsOn) return totalAmountCents;
  const days =
    (new Date(endsOn).getTime() - new Date(startsOn).getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365.25;
  if (years < 1) return totalAmountCents;
  return Math.round(totalAmountCents / years);
}

type TermLike = { startsOn: string | null; endsOn: string | null };

/**
 * El término "vigente" a mostrar por defecto en el listado: el que cubre hoy
 * si existe, o si no el más reciente (por fecha de inicio). `null` si el
 * patrocinador todavía no tiene ningún patrocinio registrado.
 */
export function pickCurrentTerm<T extends TermLike>(terms: T[], today: string): T | null {
  if (terms.length === 0) return null;
  const ongoing = terms.find(
    (t) =>
      (t.startsOn === null || t.startsOn <= today) &&
      (t.endsOn === null || t.endsOn >= today),
  );
  if (ongoing) return ongoing;
  return [...terms].sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? ""))[0];
}
