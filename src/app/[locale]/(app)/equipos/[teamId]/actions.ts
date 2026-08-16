"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { memberships, playerPosition, teamDocuments, teamNotes } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { makeDocumentActions } from "@/lib/entity-documents";
import { makeNoteActions } from "@/lib/entity-notes";

export type MembershipState = {
  error?: string;
  message?: string;
};

const MANAGE_ROLES = ["admin", "staff"] as const;
const MEMBERSHIP_ROLES = ["player", "coach", "staff"] as const;
const PLAYER_POSITIONS = playerPosition.enumValues;

function readRole(formData: FormData) {
  const value = String(formData.get("role") ?? "");
  return (MEMBERSHIP_ROLES as readonly string[]).includes(value)
    ? (value as (typeof MEMBERSHIP_ROLES)[number])
    : "player";
}

function readPositions(formData: FormData) {
  return formData
    .getAll("positions")
    .map(String)
    .filter((v): v is (typeof PLAYER_POSITIONS)[number] =>
      (PLAYER_POSITIONS as readonly string[]).includes(v),
    );
}

function readJerseyNumber(formData: FormData) {
  const value = String(formData.get("jerseyNumber") ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function addMembership(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const teamId = String(formData.get("teamId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return { error: t("personRequired") };

  try {
    await db.insert(memberships).values({
      teamId,
      personId,
      role: readRole(formData),
      jerseyNumber: readJerseyNumber(formData),
      positions: readPositions(formData),
      isCaptain: formData.get("isCaptain") === "on",
      position: String(formData.get("position") ?? "").trim() || null,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("memberAlreadyInTeam") };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { message: t("memberAdded") };
}

export async function updateMembership(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  await db
    .update(memberships)
    .set({
      role: readRole(formData),
      jerseyNumber: readJerseyNumber(formData),
      positions: readPositions(formData),
      isCaptain: formData.get("isCaptain") === "on",
      position: String(formData.get("position") ?? "").trim() || null,
      kitShirtIssued: formData.get("kitShirtIssued") === "on",
      kitPantsIssued: formData.get("kitPantsIssued") === "on",
      kitBibIssued: formData.get("kitBibIssued") === "on",
      active: formData.get("active") === "on",
    })
    .where(eq(memberships.id, id));

  revalidatePath("/", "layout");
  return { message: t("memberUpdated") };
}

export async function removeMembership(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  await db.delete(memberships).where(eq(memberships.id, id));

  revalidatePath("/", "layout");
  return { message: t("memberRemoved") };
}

// ---------------------------------------------------------------------------
// Documentos de equipo
// ---------------------------------------------------------------------------

const teamDocumentActions = makeDocumentActions({
  table: teamDocuments,
  bucket: "team-documents",
  parentIdColumn: "teamId",
  formKey: "teamId",
  namespace: "Equipos",
});
export const addTeamDocument = teamDocumentActions.add;
export const updateTeamDocument = teamDocumentActions.update;
export const deleteTeamDocument = teamDocumentActions.delete;

// ---------------------------------------------------------------------------
// Bitácora de equipo
// ---------------------------------------------------------------------------

const teamNoteActions = makeNoteActions({
  table: teamNotes,
  parentIdColumn: "teamId",
  formKey: "teamId",
  namespace: "Equipos",
});
export const addTeamNote = teamNoteActions.add;
export const deleteTeamNote = teamNoteActions.delete;
