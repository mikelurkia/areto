import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { db } from "@/db";
import { users } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifica los enlaces de correo que NO pueden usar PKCE.
 *
 * `/auth/callback` sirve para OAuth, donde el navegador que inicia el flujo es
 * el mismo que lo termina y por tanto guarda el verificador. Con una invitación
 * eso no se cumple —quien invita y quien acepta son personas distintas— y la
 * propia librería de Supabase lo documenta: `inviteUserByEmail` no soporta
 * PKCE. Lo mismo vale para el enlace de recuperación de contraseña.
 *
 * La alternativa es el token de un solo uso: la plantilla de correo apunta
 * aquí con `token_hash` y `type`, y `verifyOtp` lo canjea por una sesión. Ver
 * las instrucciones del dashboard en `supabase/setup.sql`.
 */
const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "magiclink"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const origin = getSiteUrl();

  // "next" viaja sin prefijo de idioma (lo añadimos según el idioma del perfil).
  let next = searchParams.get("next") ?? "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/dashboard";

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const profile = data.user
        ? await db.query.users.findFirst({ where: eq(users.id, data.user.id) })
        : undefined;

      // Una cuenta desactivada no entra ni con un enlace válido.
      if (profile && profile.status === "disabled") {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/${profile.locale}/acceso-revocado`,
        );
      }

      const locale = profile?.locale ?? routing.defaultLocale;
      return NextResponse.redirect(`${origin}/${locale}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/${routing.defaultLocale}/auth-code-error`,
  );
}
