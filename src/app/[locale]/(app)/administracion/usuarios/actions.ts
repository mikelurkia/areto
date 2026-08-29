"use server";

import { eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { countActiveAdminsAfter, rolesEscalate } from "@/lib/admin-guards";
import { hasPermission, requirePermission, type CurrentUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import { getSiteUrl } from "@/lib/site-url";
import { getUserRoleIds, sameRoleSet, setUserRoles } from "@/lib/user-roles";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { revalidateAppShell } from "@/lib/revalidate";

export type UserState = {
  error?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Baneo efectivamente permanente: 100 años. Supabase no acepta "para siempre". */
const BAN_FOREVER = "876000h";

/** Destino de los enlaces de invitación y de recuperación de contraseña. */
function confirmUrl(reason: "invitacion" | "recuperacion") {
  const next = encodeURIComponent(`/contrasena?motivo=${reason}`);
  return `${getSiteUrl()}/auth/confirm?next=${next}`;
}

/**
 * Traduce un error de Supabase Auth a algo que se pueda enseñar.
 *
 * No se puede pintar `error.message` a secas: ante un 500, `supabase-js` pierde
 * el cuerpo de la respuesta y devuelve un `AuthRetryableFetchError` cuyo mensaje
 * es literalmente la cadena "{}". Eso llegó a verse en pantalla. El caso real
 * detrás de ese 500 es casi siempre el SMTP: el servidor de correo por defecto
 * de Supabase solo entrega a direcciones del equipo del proyecto.
 *
 * El error completo se vuelca por consola del servidor, que es donde sirve de
 * algo; a quien usa la aplicación se le da un texto accionable.
 */
function authErrorMessage(
  error: { message?: string; code?: string; status?: number },
  t: (key: string) => string,
  fallbackKey: string,
): string {
  console.error("[administracion] Supabase Auth:", error);

  if (error.code === "email_exists") return t("emailTaken");
  if (error.code === "over_email_send_rate_limit") return t("emailRateLimited");
  if ((error.status ?? 0) >= 500) return t("emailSendFailed");

  const message = error.message?.trim();
  // "{}" y "" son ruido del cliente, no información para nadie.
  return message && message !== "{}" ? message : t(fallbackKey);
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

  if (!isSupabaseAdminConfigured) return { error: t("adminApiNotConfigured") };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleIds = await readRoleIds(formData);
  const personId = readPersonId(formData);

  if (!EMAIL_RE.test(email)) return { error: t("emailInvalid") };
  if (roleIds.length === 0) return { error: t("roleRequired") };

  if (!(await canAssignRoles(current, roleIds))) {
    return { error: t("cannotAssignAdminRole") };
  }

  // Se comprueba ANTES de invitar: si fallara después, la cuenta de Supabase ya
  // existiría y el correo ya habría salido, y habría que deshacer las dos cosas.
  if (personId) {
    const taken = await db.query.users.findFirst({
      where: eq(users.personId, personId),
      columns: { id: true },
    });
    if (taken) return { error: t("personAlreadyLinked") };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: confirmUrl("invitacion"),
    data: { full_name: fullName || null, invited_by: current.email },
  });

  if (error || !data?.user) {
    return {
      error: error
        ? authErrorMessage(error, t, "inviteFailed")
        : t("inviteFailed"),
    };
  }

  // El trigger `handle_new_user` ya ha insertado el perfil (corre dentro de la
  // misma transacción que el alta en `auth.users`), con el rol por defecto y en
  // estado `pending`. Aquí se le pone el rol elegido y se le abre el acceso.
  // Es un upsert y no un update para no depender de que el trigger exista.
  try {
    await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: data.user.id,
        email,
        fullName: fullName || null,
        personId,
        status: "active",
        invitedAt: new Date(),
        invitedBy: current.id,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          fullName: fullName || null,
          personId,
          status: "active",
          invitedAt: new Date(),
          invitedBy: current.id,
        },
      });

      // `setUserRoles` escribe la puente y, mientras dure la fase expand,
      // también `users.role_id` con el rol principal.
      await setUserRoles(tx, data.user.id, roleIds);
    });
  } catch (dbError) {
    if (isPostgresError(dbError, UNIQUE_VIOLATION)) {
      return { error: t("personAlreadyLinked") };
    }
    throw dbError;
  }

  await recordAuditEvent({
    actorUserId: current.id,
    action: "create",
    entityType: "user",
    entityId: data.user.id,
    metadata: { email, roleIds },
  });
  revalidateAppShell();
  return { message: t("inviteSent", { email }) };
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

  // El estado en `public.users` es la barrera efectiva (lo comprueba
  // `requireUser` en cada petición), pero el JWT que el usuario ya tiene en el
  // navegador sigue siendo válido hasta que caduque. El baneo en Supabase Auth
  // impide además que lo renueve.
  if (isSupabaseAdminConfigured) {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(id, {
      ban_duration: activate ? "none" : BAN_FOREVER,
    });
    if (!activate) await admin.auth.admin.signOut(id, "global");
  }

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
  if (!isSupabaseAdminConfigured) return { error: t("adminApiNotConfigured") };

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };

  const remaining = await countActiveAdminsAfter({
    userRoles: new Map([[id, null]]),
  });
  if (remaining === 0) return { error: t("lastAdminGuard") };

  // Igual que `deleteAccount` en los ajustes: primero el perfil, luego la
  // cuenta de Supabase. No hay cascada automática desde `auth.users`.
  await db.delete(users).where(eq(users.id, id));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: authErrorMessage(error, t, "userDeleteFailed") };

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

// --- Correos de soporte ------------------------------------------------------

export async function resendInvitation(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const t = await getTranslations("Administracion");
  await requirePermission("usuarios.manage");

  if (!isSupabaseAdminConfigured) return { error: t("adminApiNotConfigured") };

  const id = String(formData.get("id") ?? "");
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };

  // Con el cliente de administración, no con el de sesión: el de sesión
  // guardaría el verificador PKCE en el navegador de quien invita, no en el de
  // quien recibe el correo, y el enlace no funcionaría.
  //
  // Y un enlace mágico, no otra invitación: `inviteUserByEmail` falla con
  // `email_exists` en cuanto la cuenta existe, que es justo el caso aquí.
  const admin = createAdminClient();
  const { error } = await admin.auth.signInWithOtp({
    email: target.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmUrl("invitacion"),
    },
  });

  if (error) return { error: authErrorMessage(error, t, "inviteFailed") };

  return { message: t("invitationResent", { email: target.email }) };
}

export async function sendPasswordReset(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const t = await getTranslations("Administracion");
  await requirePermission("usuarios.manage");

  if (!isSupabaseAdminConfigured) return { error: t("adminApiNotConfigured") };

  const id = String(formData.get("id") ?? "");
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };

  const admin = createAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(target.email, {
    redirectTo: confirmUrl("recuperacion"),
  });

  if (error) return { error: authErrorMessage(error, t, "inviteFailed") };

  return { message: t("passwordResetSent", { email: target.email }) };
}
