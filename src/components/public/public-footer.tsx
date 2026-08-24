import Image from "next/image";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getClubSettings } from "@/lib/club";

/**
 * Envuelta en su propia caché: leer el reloj directamente en un Server
 * Component rompe el prerender (next-prerender-current-time) si no se ha
 * leído antes ningún dato dinámico o cacheado.
 */
async function getCopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/**
 * Pie compartido de las páginas públicas de tipo landing (home, inscripción,
 * muro de patrocinadores). Se omite en formularios y en login para no alargar
 * flujos que ya tienen su propio scroll.
 */
export async function PublicFooter() {
  const [t, club, year] = await Promise.all([
    getTranslations("Landing"),
    getClubSettings(),
    getCopyrightYear(),
  ]);

  const links = [
    { href: "/", label: t("footer.home") },
    { href: "/inscripcion", label: t("footer.registration") },
    { href: "/patrocinadores-muro", label: t("footer.sponsors") },
    { href: "/inscripcion/privacidad", label: t("footer.privacy") },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <Image src="/federations/gipuzkoana.png" alt="" width={28} height={28} className="size-7 shrink-0 object-contain opacity-70" />
          <Image src="/federations/vasca.png" alt="" width={28} height={28} className="size-7 shrink-0 object-contain opacity-70" />
          <p className="text-sm text-muted-foreground">
            {club?.legalName ?? t("brand")} · © {year}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground sm:gap-x-5">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
