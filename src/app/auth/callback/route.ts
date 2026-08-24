import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Intercambia el código OAuth por una sesión y redirige a destino.
 *
 * Solo OAuth: los enlaces de invitación y de recuperación llegan a
 * `/auth/confirm`, porque no pueden usar PKCE (ver el comentario de aquel).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const origin = getSiteUrl();

  // "next" viaja sin prefijo de idioma (lo añadimos según el idioma guardado del usuario).
  let next = searchParams.get("next") ?? "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const profile = data.user
        ? await db.query.users.findFirst({ where: eq(users.id, data.user.id) })
        : undefined;

      // Alta por Google de alguien a quien nadie ha invitado. La barrera de
      // verdad es "Allow new users to sign up = OFF" en Supabase; esto es la
      // red por debajo, para que un despiste de configuración no deje cuentas
      // sueltas. `invitedAt` está relleno en todas las cuentas anteriores a
      // este cambio (lo hace la migración), así que no afecta a nadie que ya
      // usara la aplicación.
      if (!profile || profile.invitedAt === null) {
        await supabase.auth.signOut();
        if (data.user && isSupabaseAdminConfigured) {
          await db.delete(users).where(eq(users.id, data.user.id));
          await createAdminClient().auth.admin.deleteUser(data.user.id);
        }
        return NextResponse.redirect(
          `${origin}/${routing.defaultLocale}/acceso-no-autorizado`,
        );
      }

      if (profile.status === "disabled") {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/${profile.locale}/acceso-revocado`,
        );
      }

      return NextResponse.redirect(`${origin}/${profile.locale}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/${routing.defaultLocale}/auth-code-error`,
  );
}
