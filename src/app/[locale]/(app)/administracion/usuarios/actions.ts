"use server";

import { eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { authSessions, roles, users } from "@/db/schema";
import { countActiveAdminsAfter, rolesEscalate } from "@/lib/admin-guards";
import { hasPermission, requirePermission, type CurrentUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import { sendAuthEmail } from "@/lib/auth-email";
import { createPasswordLink, type PasswordLinkKind } from "@/lib/auth-links";
import { getUserRoleIds, sameRoleSet, setUserRoles } from "@/lib/user-roles";
import { revalidateAppShell } from "@/lib/revalidate";

export type UserState = {
  error?: string;
  message?: string;
  /**
   * Enlace de invitación o de recuperación recién generado. Se devuelve siempre,
   * se haya enviado por correo o no, para que quien administra pueda copiarlo.
   */
  link?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Genera el enlace para poner contraseña y lo envía por correo si hay SMTP.
 * El mensaje dice cuál de las dos cosas ha pasado.
 */
async function issuePasswordLink(
  target: { id: string; email: string },
  kind: PasswordLinkKind,
  t: (key: string, values?: { email: string }) => string,
): Promise<UserState> {
  const link = await createPasswordLink(target.id, kind);
  const sent = await sendAuthEmail(kind, target.email, link);
  const key =
    kind === "invite"
      ? sent ? "inviteSent" : "inviteLinkReady"
      : sent ? "passwordResetSent" : "passwordResetLinkReady";
  return { message: t(key, { email: target.email }), link };
}

function readPersonId(formData: FormData): string | null {
  const raw = String(formData.get("personId") ?? "").trim();
  return raw && raw !== "none" ? raw : null;
}

/**
 * Roles enviados por el formulario, validados contra los que existen. Un id que
 * no exista se descarta en silencio; que no quede ninguno es un error visible.
 */
async function readRoleIds(formData: FormData): Promise<string[]> {
  const submitted = [...new Set(formData.getAll("roleIds").map(String))].filter(Boolean);
  if (submitted.length === 0) return [];
  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, submitted));
  return existing.map((r) => r.id);
}

/**
 * ¿Puede `actor` asignar estos roles?
 *
 * Quien solo tiene `usuarios.manage` puede dar de alta gente, pero no repartir
 * la administración: si no, invitándose a sí mismo con otro correo se saltaría
 * la separación entre dar acceso y decidir qué puede hacer cada cual.
 */
async function canAssignRoles(
  actor: CurrentUser,
  roleIds: readonly string[],
): Promise<boolean> {
  if (hasPermission(actor, "roles.manage")) return true;
  return !(await rolesEscalate(roleIds));
}

// --- Alta por invitación -----------------------------------------------------

export async function inviteUser(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("usuarios.manage");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleIds = await readRoleIds(formData);
  const personId = readPersonId(formData);

  if (!EMAIL_RE.test(email)) return { error: t("emailInvalid") };
  if (roleIds.length === 0) return { error: t("roleRequired") };

  if (!(await canAssignRoles(current, roleIds))) {
    return { error: t("cannotAssignAdminRole") };
  }

  if (personId) {
    const taken = await db.query.users.findFirst({
      where: eq(users.personId, personId),
      columns: { id: true },
    });
    if (taken) return { error: t("personAlreadyLinked") };
  }

  // La cuenta nace activa y sin contraseña: la pone quien recibe el enlace.
  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          fullName: fullName || null,
          personId,
          status: "active",
          invitedAt: new Date(),
          invitedBy: current.id,
        })
        .returning({ id: users.id });

      // `setUserRoles` escribe la puente y, mientras dure la fase expand,
      // también `users.role_id` con el rol principal.
      await setUserRoles(tx, created.id, roleIds);
      return created.id;
    });
  } catch (dbError) {
    // Dos únicos posibles: el correo o la persona ya tienen cuenta.
    if (isPostgresError(dbError, UNIQUE_VIOLATION)) {
      const emailTaken = await db.query.users.findFirst({
        where: eq(users.email, email),
        columns: { id: true },
      });
      return { error: t(emailTaken ? "emailTaken" : "personAlreadyLinked") };
    }
    throw dbError;
  }

  await recordAuditEvent({
    actorUserId: current.id,
    action: "create",
    entityType: "user",
    entityId: userId,
    metadata: { email, roleIds },
  });
  revalidateAppShell();
  return issuePasswordLink({ id: userId, email }, "invite", t);
}

// --- Edición -----------------------------------------------------------------

export async function updateUser(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("usuarios.manage");

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const nextRoleIds = await readRoleIds(formData);
  const personId = readPersonId(formData);

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };
  if (nextRoleIds.length === 0) return { error: t("roleRequired") };

  const currentRoleIds = await getUserRoleIds(id);
  const changesRole = !sameRoleSet(currentRoleIds, nextRoleIds);

  // Cambiarse el rol a uno mismo es la vía más rápida de perder el acceso a
  // esta pantalla sin querer, y no hay ningún caso legítimo: para eso está
  // otra persona con permiso de administración.
  if (changesRole && id === current.id) return { error: t("cannotChangeOwnRole") };

  // Solo se comprueba sobre los roles que se AÑADEN: quitar uno que escala es
  // una des-escalada, y exigir el permiso para eso impediría hasta corregirle
  // el nombre a alguien que ya es administrador.
  const addedRoleIds = nextRoleIds.filter((r) => !currentRoleIds.includes(r));
  if (!(await canAssignRoles(current, addedRoleIds))) {
    return { error: t("cannotAssignAdminRole") };
  }

  if (changesRole && target.status === "active") {
    const remaining = await countActiveAdminsAfter({
      userRoles: new Map([[id, nextRoleIds]]),
    });
    if (remaining === 0) return { error: t("lastAdminGuard") };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ fullName: fullName || null, personId })
        .where(eq(users.id, id));

      await setUserRoles(tx, id, nextRoleIds);
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      return { error: t("personAlreadyLinked") };
    }
    throw error;
  }

  if (changesRole) {
    await recordAuditEvent({
      actorUserId: current.id,
      action: "update",
      entityType: "user_role",
      entityId: id,
      metadata: { from: currentRoleIds, to: nextRoleIds },
    });
  }
  revalidateAppShell();
  return { message: t("userUpdated") };
}

// --- Activar / desactivar ----------------------------------------------------

export async function toggleUserStatus(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("usuarios.manage");

  const id = String(formData.get("id") ?? "");
  const activate = formData.get("activate") === "true";

  if (id === current.id) return { error: t("cannotDeactivateSelf") };

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };
  if ((await getUserRoleIds(id)).length === 0) {
    return { error: t("userWithoutRole") };
  }

  if (!activate) {
    const remaining = await countActiveAdminsAfter({
      userRoles: new Map([[id, null]]),
    });
    if (remaining === 0) return { error: t("lastAdminGuard") };
  }

  await db
    .update(users)
    .set({
      status: activate ? "active" : "disabled",
      disabledAt: activate ? null : new Date(),
    })
    .where(eq(users.id, id));

  // `requireUser` ya le cierra la puerta en la siguiente petición por el
  // estado; borrar sus sesiones además le saca de inmediato.
  if (!activate) await db.delete(authSessions).where(eq(authSessions.userId, id));

  await recordAuditEvent({
    actorUserId: current.id,
    action: "update",
    entityType: "user",
    entityId: id,
    metadata: { status: activate ? "active" : "disabled" },
  });
  revalidateAppShell();
  return { message: activate ? t("userReactivated") : t("userDeactivated") };
}

// --- Borrado -----------------------------------------------------------------

export async function deleteUser(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("usuarios.manage");

  const id = String(formData.get("id") ?? "");
  if (id === current.id) return { error: t("cannotDeleteSelf") };

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };

  const remaining = await countActiveAdminsAfter({
    userRoles: new Map([[id, null]]),
  });
  if (remaining === 0) return { error: t("lastAdminGuard") };

  // Sus sesiones y su contraseña caen en cascada.
  await db.delete(users).where(eq(users.id, id));

  await recordAuditEvent({
    actorUserId: current.id,
    action: "delete",
    entityType: "user",
    entityId: id,
    metadata: { email: target.email },
  });
  revalidateAppShell();
  return { message: t("userDeleted") };
}

// --- Enlaces para poner contraseña ------------------------------------------

export async function resendInvitation(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  return reissueLink(formData, "invite");
}

export async function sendPasswordReset(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  return reissueLink(formData, "recovery");
}

async function reissueLink(formData: FormData, kind: PasswordLinkKind): Promise<UserState> {
  const t = await getTranslations("Administracion");
  await requirePermission("usuarios.manage");

  const id = String(formData.get("id") ?? "");
  const target = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, email: true },
  });
  if (!target) return { error: t("userNotFound") };

  return issuePasswordLink(target, kind, t);
}
