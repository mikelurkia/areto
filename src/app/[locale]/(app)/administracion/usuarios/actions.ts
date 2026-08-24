"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { roles, users } from "@/db/schema";
import {
  countActiveAdmins,
  getRolePermissions,
  roleEscalates,
} from "@/lib/admin-guards";
import { hasPermission, requirePermission, type CurrentUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

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

function readPersonId(formData: FormData): string | null {
  const raw = String(formData.get("personId") ?? "").trim();
  return raw && raw !== "none" ? raw : null;
}

/**
 * ¿Puede `actor` asignar el rol `roleId`?
 *
 * Quien solo tiene `usuarios.manage` puede dar de alta gente, pero no repartir
 * la administración: si no, invitándose a sí mismo con otro correo se saltaría
 * la separación entre dar acceso y decidir qué puede hacer cada cual.
 */
async function canAssignRole(actor: CurrentUser, roleId: string): Promise<boolean> {
  if (hasPermission(actor, "roles.manage")) return true;
  return !(await roleEscalates(roleId));
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
  const roleId = String(formData.get("roleId") ?? "").trim();
  const personId = readPersonId(formData);

  if (!EMAIL_RE.test(email)) return { error: t("emailInvalid") };
  if (!roleId) return { error: t("roleRequired") };

  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) return { error: t("roleNotFound") };
  if (!(await canAssignRole(current, roleId))) {
    return { error: t("cannotAssignAdminRole") };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: confirmUrl("invitacion"),
    data: { full_name: fullName || null, invited_by: current.email },
  });

  if (error || !data?.user) {
    if (error?.code === "email_exists") return { error: t("emailTaken") };
    if (error?.code === "over_email_send_rate_limit") {
      return { error: t("emailRateLimited") };
    }
    return { error: error?.message ?? t("inviteFailed") };
  }

  // El trigger `handle_new_user` ya ha insertado el perfil (corre dentro de la
  // misma transacción que el alta en `auth.users`), con el rol por defecto y en
  // estado `pending`. Aquí se le pone el rol elegido y se le abre el acceso.
  // Es un upsert y no un update para no depender de que el trigger exista.
  try {
    await db
      .insert(users)
      .values({
        id: data.user.id,
        email,
        fullName: fullName || null,
        roleId,
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
          roleId,
          personId,
          status: "active",
          invitedAt: new Date(),
          invitedBy: current.id,
        },
      });
  } catch (dbError) {
    if (dbError && typeof dbError === "object" && "code" in dbError && dbError.code === "23505") {
      return { error: t("personAlreadyLinked") };
    }
    throw dbError;
  }

  revalidatePath("/", "layout");
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
  const roleId = String(formData.get("roleId") ?? "").trim();
  const personId = readPersonId(formData);

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: t("userNotFound") };
  if (!roleId) return { error: t("roleRequired") };

  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) return { error: t("roleNotFound") };

  const changesRole = target.roleId !== roleId;

  // Cambiarse el rol a uno mismo es la vía más rápida de perder el acceso a
  // esta pantalla sin querer, y no hay ningún caso legítimo: para eso está
  // otra persona con permiso de administración.
  if (changesRole && id === current.id) return { error: t("cannotChangeOwnRole") };

  if (changesRole && !(await canAssignRole(current, roleId))) {
    return { error: t("cannotAssignAdminRole") };
  }

  if (changesRole && target.status === "active") {
    const newPermissions = await getRolePermissions(roleId);
    if (!newPermissions.has("usuarios.manage")) {
      const remaining = await countActiveAdmins({ excludeUserId: id });
      if (remaining === 0) return { error: t("lastAdminGuard") };
    }
  }

  try {
    await db
      .update(users)
      .set({ fullName: fullName || null, roleId, personId })
      .where(eq(users.id, id));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("personAlreadyLinked") };
    }
    throw error;
  }

  revalidatePath("/", "layout");
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
  if (!target.roleId) return { error: t("userWithoutRole") };

  if (!activate) {
    const remaining = await countActiveAdmins({ excludeUserId: id });
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

  revalidatePath("/", "layout");
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

  const remaining = await countActiveAdmins({ excludeUserId: id });
  if (remaining === 0) return { error: t("lastAdminGuard") };

  // Igual que `deleteAccount` en los ajustes: primero el perfil, luego la
  // cuenta de Supabase. No hay cascada automática desde `auth.users`.
  await db.delete(users).where(eq(users.id, id));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
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

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: t("emailRateLimited") };
    }
    return { error: error.message };
  }

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

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: t("emailRateLimited") };
    }
    return { error: error.message };
  }

  return { message: t("passwordResetSent", { email: target.email }) };
}
