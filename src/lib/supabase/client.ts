import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * Cliente de Supabase para componentes de cliente (navegador). Sin sesión: solo
 * sirve para subir a una URL firmada, que lleva su propio token.
 */
export function createClient() {
  return createSupabaseClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
