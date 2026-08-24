"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { REGISTRATION_AVAILABILITY_TAG } from "@/lib/registration-settings";

export type SeasonState = {
  error?: string;
  message?: string;
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
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("seasonNameTaken") };
    }
    throw error;
  }

  updateTag(REGISTRATION_AVAILABILITY_TAG);
  revalidatePath("/", "layout");
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
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("seasonNameTaken") };
    }
    throw error;
  }

  updateTag(REGISTRATION_AVAILABILITY_TAG);
  revalidatePath("/", "layout");
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
    if (error && typeof error === "object" && "code" in error && error.code === "23503") {
      return { error: t("seasonHasTeamsError") };
    }
    throw error;
  }

  updateTag(REGISTRATION_AVAILABILITY_TAG);
  revalidatePath("/", "layout");
  return { message: t("seasonDeleted") };
}
