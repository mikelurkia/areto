import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * Cliente de Supabase para el servidor (Server Components, Route Handlers,
 * Server Actions). Gestiona las cookies de sesión con `next/headers`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: se puede ignorar si el
          // middleware refresca las sesiones (que es nuestro caso).
        }
      },
    },
  });
}
