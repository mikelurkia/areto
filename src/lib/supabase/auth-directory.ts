import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "./admin";

/**
 * Lo que `auth.users` sabe de una cuenta y `public.users` no.
 *
 * Se lee de la Admin API en lugar de duplicarlo en nuestra tabla: el esquema
 * `auth` no está en Drizzle (ni queremos que lo esté), y "cuándo entró por
 * última vez" o "si ya confirmó el correo" son datos de los que Supabase ya es
 * dueño. Duplicarlos obligaría a reconciliarlos.
 */
export type AuthDirectoryEntry = {
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
};

/** Máximo de cuentas que se piden de una vez. Un club no llega ni de lejos. */
const PAGE_SIZE = 1000;

/**
 * Estado de `auth.users` indexado por id.
 *
 * Devuelve un mapa VACÍO —no lanza— si falta la clave de servicio: la pantalla
 * de usuarios sigue funcionando y muestra "—" en las columnas que dependen de
 * esto, igual que hace `deleteAccount` en los ajustes de la cuenta. Que no
 * haya SMTP o clave configurados no debe tumbar la administración entera.
 */
export async function listAuthDirectory(): Promise<Map<string, AuthDirectoryEntry>> {
  if (!isSupabaseAdminConfigured) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: PAGE_SIZE,
  });

  if (error || !data) return new Map();

  return new Map(
    data.users.map((u) => [
      u.id,
      {
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        // `banned_until` no está en el tipo público de `User`, pero la API lo
        // devuelve: es como se marca una cuenta baneada desde la Admin API.
        bannedUntil:
          (u as { banned_until?: string | null }).banned_until ?? null,
      },
    ]),
  );
}
