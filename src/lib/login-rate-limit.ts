import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { authRateLimits } from "@/db/schema";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

/**
 * ¿Ha agotado este correo sus intentos de login del último minuto?
 *
 * Hace falta aparte del rate limit de Better Auth: ese solo se aplica a las
 * peticiones HTTP a /api/auth/*, y el login entra por una Server Action que
 * llama a `auth.api.signInEmail` directamente. Usa la misma tabla con su propia
 * clave, y cuenta cada intento en una sola sentencia para que dos peticiones
 * simultáneas no lean el mismo contador.
 */
export async function isLoginRateLimited(email: string): Promise<boolean> {
  const now = Date.now();
  const [row] = await db
    .insert(authRateLimits)
    .values({ key: `login:${email.toLowerCase()}`, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        count: sql`case when ${authRateLimits.lastRequest} < ${now - WINDOW_MS} then 1 else ${authRateLimits.count} + 1 end`,
        lastRequest: sql`case when ${authRateLimits.lastRequest} < ${now - WINDOW_MS} then ${now} else ${authRateLimits.lastRequest} end`,
      },
    })
    .returning({ count: authRateLimits.count });

  return row.count > MAX_ATTEMPTS;
}
