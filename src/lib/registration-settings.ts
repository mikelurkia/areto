import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { seasons } from "@/db/schema";

export type RegistrationAvailability = {
  seasonId: string | null;
  seasonName: string | null;
  teamRegistrationOpen: boolean;
  memberOpen: boolean;
  memberAnnualFeeCents: number;
};

/** Etiqueta de caché de la disponibilidad de inscripción; la invalidan las acciones de club y de temporada. */
export const REGISTRATION_AVAILABILITY_TAG = "registration-availability";

/**
 * Único punto de verdad sobre si los formularios públicos de inscripción
 * aceptan envíos ahora mismo. El interruptor abierto/cerrado es global (dato
 * del club, no de cada temporada: solo hay una temporada activa a la vez).
 * Sin temporada actual no hay dónde colgar la inscripción, así que ambos
 * están cerrados aunque el interruptor esté activado.
 *
 * Cacheada con `use cache` (mismo patrón que `getClubSettings`): no depende
 * del usuario ni de la petición, y la piden las páginas públicas de
 * inscripción, que así pueden formar parte del armazón estático en vez de
 * bloquear el render. Las acciones de club y de temporada la invalidan por etiqueta.
 */
export async function getRegistrationAvailability(): Promise<RegistrationAvailability> {
  "use cache";
  cacheTag(REGISTRATION_AVAILABILITY_TAG);
  cacheLife("max");

  const [settings, season] = await Promise.all([
    db.query.clubSettings.findFirst({
      columns: {
        playerRegistrationOpen: true,
        memberRegistrationOpen: true,
        memberAnnualFeeCents: true,
      },
    }),
    db.query.seasons.findFirst({
      where: eq(seasons.isCurrent, true),
      columns: { id: true, name: true },
    }),
  ]);

  return {
    seasonId: season?.id ?? null,
    seasonName: season?.name ?? null,
    teamRegistrationOpen: Boolean(season) && (settings?.playerRegistrationOpen ?? false),
    memberOpen: Boolean(season) && (settings?.memberRegistrationOpen ?? false),
    memberAnnualFeeCents: settings?.memberAnnualFeeCents ?? 2000,
  };
}
