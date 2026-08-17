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

  // La capitanía no se toca aquí: es del equipo (ver `updateTeamCaptain`).
  await db
    .update(memberships)
    .set({
      role: readRole(formData),
      jerseyNumber: readJerseyNumber(formData),
      positions: readPositions(formData),
      position: String(formData.get("position") ?? "").trim() || null,
    })
    .where(eq(memberships.id, id));

  revalidatePath("/", "layout");
  return { message: t("memberUpdated") };
}

/**
 * Designa al capitán del equipo. Es una característica del equipo, no de la
 * persona: el brazalete es único, así que la acción se lo quita a quien lo
 * tuviera antes. Sin selección (o con una membresía de otro equipo) el equipo
 * se queda sin capitán.
 */
export async function updateTeamCaptain(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const teamId = String(formData.get("teamId") ?? "");
  const selectedId = String(formData.get("captainMembershipId") ?? "");

  const teamMemberships = await db.query.memberships.findMany({
    where: eq(memberships.teamId, teamId),
    columns: { id: true, isCaptain: true },
  });

  const captainId = teamMemberships.some((m) => m.id === selectedId) ? selectedId : null;
  const updates = teamMemberships.filter((m) => m.isCaptain !== (m.id === captainId));

  if (updates.length > 0) {
    await db.transaction(async (tx) => {
      for (const membership of updates) {
        await tx
          .update(memberships)
          .set({ isCaptain: membership.id === captainId })
          .where(eq(memberships.id, membership.id));
      }
    });
  }

  revalidatePath("/", "layout");
  return { message: t("captainUpdated") };
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
