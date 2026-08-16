import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./config";

/**
 * Clave de servicio (bypassa RLS y da acceso a la Admin API). NUNCA exponer
 * al cliente: solo se usa en Server Actions/Route Handlers (p.ej. borrar la
 * cuenta de `auth.users`, algo que la clave pública no puede hacer).
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(
  SUPABASE_URL && SERVICE_ROLE_KEY,
);

/** Cliente con privilegios de administrador. Solo llamar tras comprobar `isSupabaseAdminConfigured`. */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
