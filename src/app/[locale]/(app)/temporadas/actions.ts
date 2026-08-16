"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { memberships, seasonTaskKind, seasonTasks, seasons, teams } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { expandTemplate, type SeasonTaskKind } from "@/lib/season-tasks";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";

export type SeasonTaskState = {
  error?: string;
  message?: string;
};

const MANAGE_ROLES = ["admin", "staff"] as const;

const PROOF_BUCKET = "season-task-proofs";
const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_PROOF_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

// --- lectores de FormData ---------------------------------------------------

function readKind(formData: FormData): SeasonTaskKind {
  const value = String(formData.get("kind") ?? "");
  return (seasonTaskKind.enumValues as readonly string[]).includes(value)
    ? (value as SeasonTaskKind)
    : "otro";
}

function readStatus(formData: FormData): "pending" | "in_progress" | "done" {
  const value = String(formData.get("status") ?? "");
  return value === "in_progress" || value === "done" ? value : "pending";
}

function readTeamId(formData: FormData): string | null {
  const value = String(formData.get("teamId") ?? "");
  return value && value !== "none" ? value : null;
}

function readDate(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function readAmountCents(formData: FormData): number | null {
  const value = String(formData.get("amount") ?? "").trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function readFile(formData: FormData, field: string): File | null {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

function validateProof(
  file: File | null,
  messages: { invalidType: string; tooLarge: string },
): string | null {
  if (!file) return null;
  if (!ALLOWED_PROOF_TYPES.includes(file.type)) return messages.invalidType;
  if (file.size > MAX_PROOF_BYTES) return messages.tooLarge;
  return null;
}

async function uploadProof(taskId: string, field: string, file: File): Promise<string> {
  const path = `${taskId}/${field}.${extensionFromMimeType(file.type)}`;
  await uploadFile(PROOF_BUCKET, path, file);
  return path;
}

// --- generación desde plantilla --------------------------------------------

/**
 * Genera la checklist estándar de arranque para una temporada, instanciando la
 * plantilla sobre los equipos de esa temporada (copa solo para juvenil/senior).
 * Idempotente: no duplica un trámite (kind + equipo) que ya exista. Análogo a
 * `generateAnnualities` de patrocinios.
 */
export async function generateSeasonTasks(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const seasonId = String(formData.get("seasonId") ?? "");
  if (!seasonId) return { error: t("seasonRequired") };

  const seasonTeams = await db.query.teams.findMany({
    where: eq(teams.seasonId, seasonId),
    columns: { id: true, category: true },
  });
  if (seasonTeams.length === 0) return { error: t("generateNoTeams") };

  const existing = await db.query.seasonTasks.findMany({
    where: eq(seasonTasks.seasonId, seasonId),
    columns: { kind: true, teamId: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.kind}:${e.teamId ?? ""}`));

  const rows = expandTemplate(seasonTeams)
    .filter((row) => !existingKeys.has(`${row.kind}:${row.teamId}`))
    .map((row) => ({
      seasonId,
      teamId: row.teamId,
      kind: row.kind,
      title: t(`kindTitle.${row.kind}`),
      sortOrder: row.sortOrder,
    }));

  if (rows.length === 0) return { error: t("generateAllExist") };
  await db.insert(seasonTasks).values(rows);

  revalidatePath("/", "layout");
  return { message: t("generated", { count: rows.length }) };
}

// --- CRUD de trámites -------------------------------------------------------

export async function createSeasonTask(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const seasonId = String(formData.get("seasonId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!seasonId) return { error: t("seasonRequired") };
  if (!title) return { error: t("titleRequired") };

  await db.insert(seasonTasks).values({
    seasonId,
    teamId: readTeamId(formData),
    kind: readKind(formData),
    title,
    status: readStatus(formData),
    dueDate: readDate(formData, "dueDate"),
    amountCents: readAmountCents(formData),
    paidOn: readDate(formData, "paidOn"),
    assignee: String(formData.get("assignee") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  revalidatePath("/", "layout");
  return { message: t("taskCreated") };
}

export async function updateSeasonTask(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: t("titleRequired") };

  const proof = readFile(formData, "proof");
  const doc = readFile(formData, "doc");
  const proofMessages = { invalidType: t("proofInvalidType"), tooLarge: t("proofTooLarge") };
  const proofError =
    validateProof(proof, proofMessages) ?? validateProof(doc, proofMessages);
  if (proofError) return { error: proofError };

  const existing = await db.query.seasonTasks.findFirst({
    where: eq(seasonTasks.id, id),
    columns: { id: true, proofPath: true, docPath: true },
  });
  if (!existing) return { error: t("taskNotFound") };

  await db
    .update(seasonTasks)
    .set({
      teamId: readTeamId(formData),
      kind: readKind(formData),
      title,
      status: readStatus(formData),
      dueDate: readDate(formData, "dueDate"),
      amountCents: readAmountCents(formData),
      paidOn: readDate(formData, "paidOn"),
      assignee: String(formData.get("assignee") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .where(eq(seasonTasks.id, id));

  // Justificante bancario
  if (proof) {
    if (existing.proofPath) await removeFile(PROOF_BUCKET, existing.proofPath);
    const path = await uploadProof(id, "proof", proof);
    await db.update(seasonTasks).set({ proofPath: path }).where(eq(seasonTasks.id, id));
  } else if (formData.get("removeProof") === "on" && existing.proofPath) {
    await removeFile(PROOF_BUCKET, existing.proofPath);
    await db.update(seasonTasks).set({ proofPath: null }).where(eq(seasonTasks.id, id));
  }

  // Documentación enviada
  if (doc) {
    if (existing.docPath) await removeFile(PROOF_BUCKET, existing.docPath);
    const path = await uploadProof(id, "doc", doc);
    await db.update(seasonTasks).set({ docPath: path }).where(eq(seasonTasks.id, id));
  } else if (formData.get("removeDoc") === "on" && existing.docPath) {
    await removeFile(PROOF_BUCKET, existing.docPath);
    await db.update(seasonTasks).set({ docPath: null }).where(eq(seasonTasks.id, id));
  }

  revalidatePath("/", "layout");
  return { message: t("taskUpdated") };
}

export async function deleteSeasonTask(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.seasonTasks.findFirst({
    where: eq(seasonTasks.id, id),
    columns: { proofPath: true, docPath: true },
  });

  await db.delete(seasonTasks).where(eq(seasonTasks.id, id));

  if (existing?.proofPath) await removeFile(PROOF_BUCKET, existing.proofPath);
  if (existing?.docPath) await removeFile(PROOF_BUCKET, existing.docPath);

  revalidatePath("/", "layout");
  return { message: t("taskDeleted") };
}

/** Cambia el estado de un trámite en un clic (checklist). */
export async function setSeasonTaskStatus(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const status = readStatus(formData);
  await db.update(seasonTasks).set({ status }).where(eq(seasonTasks.id, id));

  revalidatePath("/", "layout");
  return {};
}

// --- inscripción de jugadores (rollup del trámite paraguas) -----------------

/**
 * Marca/desmarca a un jugador como inscrito en la plataforma federativa. Se
 * invoca desde el roster del equipo; alimenta el rollup del trámite
 * `alta_jugadores_plataforma`.
 */
export async function setMembershipFederationRegistered(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const registered = formData.get("registered") === "on";
  await db
    .update(memberships)
    .set({ federationRegistered: registered })
    .where(eq(memberships.id, id));

  revalidatePath("/", "layout");
  return {};
}

/** Marca a todos los jugadores activos de un equipo como inscritos, de una vez. */
export async function registerAllTeamPlayers(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) return { error: t("taskNotFound") };

  await db
    .update(memberships)
    .set({ federationRegistered: true })
    .where(and(eq(memberships.teamId, teamId), eq(memberships.role, "player")));

  revalidatePath("/", "layout");
  return { message: t("allPlayersRegistered") };
}

// --- CRUD de temporadas ------------------------------------------------------

function readSeasonDates(formData: FormData) {
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim();
  return { startsOn: startsOn || null, endsOn: endsOn || null };
}

export async function createSeason(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const name = String(formData.get("name") ?? "").trim();
  const makeCurrent = formData.get("makeCurrent") === "on";
  const { startsOn, endsOn } = readSeasonDates(formData);

  if (!name) return { error: t("seasonNameRequired") };

  try {
    await db.transaction(async (tx) => {
      if (makeCurrent) {
        await tx.update(seasons).set({ isCurrent: false });
      }
      await tx.insert(seasons).values({ name, startsOn, endsOn, isCurrent: makeCurrent });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("seasonNameTaken") };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { message: t("seasonCreated") };
}

export async function updateSeason(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

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

  revalidatePath("/", "layout");
  return { message: t("seasonUpdated") };
}

export async function deleteSeason(
  _prev: SeasonTaskState,
  formData: FormData,
): Promise<SeasonTaskState> {
  const t = await getTranslations("Temporadas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  try {
    await db.delete(seasons).where(eq(seasons.id, id));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23503") {
      return { error: t("seasonHasTeamsError") };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { message: t("seasonDeleted") };
}
