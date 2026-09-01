"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import {
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  isPostgresError,
  postgresConstraint,
} from "@/lib/db-errors";
import { REGISTRATION_AVAILABILITY_TAG } from "@/lib/registration-settings";
import { SEASON_RENEWALS_TAG } from "@/lib/season-renewals";

export type SeasonState = {
  error?: string;
  message?: string;
};

/**
 * Las tres tablas que cuelgan de una temporada con `onDelete: "restrict"`. El
 * mensaje dice cuál de ellas la retiene: decir siempre "tiene equipos" mandaba
 * a vaciar unos equipos que podían no existir, cuando lo que sobraba era una
 * inscripción o una cuota.
 */
const SEASON_BLOCKERS: Record<string, string> = {
  teams_season_id_seasons_id_fk: "seasonHasTeamsError",
  registrations_season_id_seasons_id_fk: "seasonHasRegistrationsError",
  fees_season_id_seasons_id_fk: "seasonHasFeesError",
};

// --- CRUD de temporadas ------------------------------------------------------

function readSeasonDates(formData: FormData) {
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim();
  return { startsOn: startsOn || null, endsOn: endsOn || null };
}

export async function createSeason(
  _prev: SeasonState,
  formData: FormData,
): Promise<SeasonState> {
  const t = await getTranslations("Temporadas");
  await requirePermission("temporadas.manage");

  const name = String(formData.get("name") ?? "").trim();
  const makeCurrent = formData.get("makeCurrent") === "on";
  const { startsOn, endsOn } = readSeasonDates(formData);

  if (!name) return { error: t("seasonNameRequired") };

  try {
    await db.transaction(async (tx) => {
      if (makeCurrent) {
        await tx.update(seasons).set({ isCurrent: false });
      }
      await tx.insert(seasons).values({
        name,
        startsOn,
        endsOn,
        isCurrent: makeCurrent,
      });
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      return { error: t("seasonNameTaken") };
    }
    throw error;
  }

  updateTag(REGISTRATION_AVAILABILITY_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  return { message: t("seasonCreated") };
}

export async function updateSeason(
  _prev: SeasonState,
  formData: FormData,
): Promise<SeasonState> {
  const t = await getTranslations("Temporadas");
  await requirePermission("temporadas.manage");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const makeCurrent = formData.get("makeCurrent") === "on";
  const { startsOn, endsOn } = readSeasonDates(formData);

  if (!name) return { error: t("seasonNameRequired") };

  try {
    await db.transaction(async (tx) => {
      if (makeCurrent) {
        await tx.update(seasons).set({ isCurrent: false });
      }
      await tx
        .update(seasons)
        .set({ name, startsOn, endsOn, isCurrent: makeCurrent })
        .where(eq(seasons.id, id));
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      return { error: t("seasonNameTaken") };
    }
    throw error;
  }

  updateTag(REGISTRATION_AVAILABILITY_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  return { message: t("seasonUpdated") };
}

export async function deleteSeason(
  _prev: SeasonState,
  formData: FormData,
): Promise<SeasonState> {
  const t = await getTranslations("Temporadas");
  await requirePermission("temporadas.manage");

  const id = String(formData.get("id") ?? "");

  try {
    await db.delete(seasons).where(eq(seasons.id, id));
  } catch (error) {
    if (isPostgresError(error, FOREIGN_KEY_VIOLATION)) {
      return { error: t(SEASON_BLOCKERS[postgresConstraint(error) ?? ""] ?? "seasonInUseError") };
    }
    throw error;
  }

  updateTag(REGISTRATION_AVAILABILITY_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  return { message: t("seasonDeleted") };
}
