import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/** Intercambia el código OAuth/email por una sesión y redirige a destino. */
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
      const locale = profile?.locale ?? routing.defaultLocale;
      return NextResponse.redirect(`${origin}/${locale}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/${routing.defaultLocale}/auth-code-error`,
  );
}
