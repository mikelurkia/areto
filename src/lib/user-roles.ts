import "server-only";

import { and, eq, inArray, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { roles, userRoles, users } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * ¿Son el mismo conjunto de roles? El orden no cuenta.
 *
 * Sirve para "¿está cambiando sus propios roles?", que con un rol único era una
 * comparación de strings y ahora no lo es.
 */
export function sameRoleSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Roles que tiene ahora mismo esta cuenta, tal y como están guardados. */
export async function getUserRoleIds(userId: string): Promise<string[]> {
  const rows = await db.query.userRoles.findMany({
    where: eq(userRoles.userId, userId),
    columns: { roleId: true },
  });
  return rows.map((r) => r.roleId);
}

/**
 * Fija el conjunto de roles de una cuenta. ÚNICO camino de escritura.
 *
 * Escribe en dos sitios a propósito:
 *
 * 1. `user_roles`, que es la fuente de verdad.
 * 2. DEUDA EXPAND: `users.role_id`, con el rol "principal" (el de menor
 *    `sortOrder`). La función `public.user_has_permission` de
 *    `supabase/setup.sql` todavía lo lee, y ese fichero se aplica a mano y no
 *    por migración: mientras no esté desplegada su v2 en producción, dejar de
 *    escribir esta columna dejaría las políticas RLS de Storage con datos
 *    rancios. Al retirar la columna, esta segunda escritura desaparece.
 *
 * El principal es el de menor `sortOrder`, o sea el más poderoso (`admin` = 10).
 * Como la unión siempre contiene lo que concede el principal, durante la
 * ventana las RLS viejas conceden un SUBCONJUNTO de lo que concede la
 * aplicación: como mucho se ve un 403 al abrir un fichero, nunca acceso de más.
 * Es el lado seguro por el que equivocarse.
 *
 * Recibe la transacción para poder ir junto a las guardas que la preceden.
 */
export async function setUserRoles(
  tx: Tx,
  userId: string,
  roleIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(roleIds)];

  if (unique.length === 0) {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.update(users).set({ roleId: null }).where(eq(users.id, userId));
    return;
  }

  // Fuera los que ya no toquen…
  await tx
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), notInArray(userRoles.roleId, unique)));

  // …y dentro los que falten. La PK compuesta hace el resto.
  await tx
    .insert(userRoles)
    .values(unique.map((roleId) => ({ userId, roleId })))
    .onConflictDoNothing();

  const [principal] = await tx
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, unique))
    .orderBy(roles.sortOrder)
    .limit(1);

  await tx
    .update(users)
    .set({ roleId: principal?.id ?? null })
    .where(eq(users.id, userId));
}
