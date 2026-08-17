import { Suspense } from "react";
import { ArrowLeftIcon, HandshakeIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { db } from "@/db";
import { getClubSettings } from "@/lib/club";
import { pickCurrentTerm, sponsorshipStatus, SPONSORSHIP_EXPIRY_WINDOW_DAYS } from "@/lib/sponsorship";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { getSignedUrls } from "@/lib/supabase/storage";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";

const LOGO_BUCKET = "sponsorship-logos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Patrocinadores" });
  return { title: t("publicWallTitle") };
}

type WallSponsor = {
  id: string;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  isPrincipal: boolean;
};

/**
 * Rejilla de patrocinadores vigentes. Se queda sin cachear a propósito: las URL
 * firmadas de los logos caducan en una hora, así que se calculan por petición y
 * fluyen tras el armazón (cabecera y titular, que sí son estáticos).
 */
async function SponsorWall() {
  const t = await getTranslations("Patrocinadores");

  const allSponsors = await db.query.sponsors.findMany({
    with: { terms: true },
    orderBy: (sponsors, { asc }) => [asc(sponsors.name)],
  });

  // El reloj se lee después de la consulta a propósito: con Cache Components,
  // leer la hora antes de tocar datos dinámicos congelaría "hoy" en el armazón
  // estático (ver next-prerender-current-time).
  const today = new Date().toISOString().slice(0, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + SPONSORSHIP_EXPIRY_WINDOW_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  // Solo patrocinadores con un patrocinio vigente esta temporada (vigente o
  // por vencer, no vencidos ni sin patrocinio).
  const active = allSponsors
    .map((s) => {
      const term = pickCurrentTerm(s.terms, today);
      const status = term ? sponsorshipStatus(term.endsOn, today, cutoff) : null;
      return { sponsor: s, term, status };
    })
    .filter(
      (x) => x.status === "active" || x.status === "expiringSoon",
    );

  // Firma de logos (bucket privado) con la clave de servicio, para poder
  // mostrarlos en una página pública sin sesión.
  const logoUrls = isSupabaseAdminConfigured
    ? await getSignedUrls(
        LOGO_BUCKET,
        active,
        (x) => x.sponsor.logoPath,
        (x) => x.sponsor.id,
        { client: createAdminClient() },
      )
    : new Map<string, string>();

  const sponsors: WallSponsor[] = active.map((x) => ({
    id: x.sponsor.id,
    name: x.sponsor.name,
    websiteUrl: x.sponsor.websiteUrl,
    logoUrl: logoUrls.get(x.sponsor.id) ?? null,
    isPrincipal: x.term?.tier === "principal",
  }));

  const principals = sponsors.filter((s) => s.isPrincipal);
  const rest = sponsors.filter((s) => !s.isPrincipal);

  if (sponsors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <HandshakeIcon className="size-8" />
        <p>{t("publicWallEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {principals.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {principals.map((s) => (
            <SponsorCard
              key={s.id}
              sponsor={s}
              size="lg"
              principalLabel={t("tier.principal")}
            />
          ))}
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rest.map((s) => (
            <SponsorCard key={s.id} sponsor={s} size="md" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Hueco de la rejilla mientras se firman los logos. */
function SponsorWallSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Muro público. Cabecera y titular se prerenderizan (el nombre del club sale de
 * `getClubSettings`, que está cacheada) y la rejilla llega por streaming.
 */
export default async function PublicSponsorsWallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);

  const [t, club] = await Promise.all([
    getTranslations("Patrocinadores"),
    getClubSettings(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            {t("publicWallBackHome")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-6 py-16 text-center md:py-20">
        {club?.legalName ? (
          <p className="text-sm font-medium text-muted-foreground">
            {club.legalName}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {t("publicWallTitle")}
        </h1>
        <p className="max-w-xl text-muted-foreground">
          {t("publicWallSubtitle")}
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <Suspense fallback={<SponsorWallSkeleton />}>
          <SponsorWall />
        </Suspense>
      </section>
    </div>
  );
}

function SponsorCard({
  sponsor,
  size,
  principalLabel,
}: {
  sponsor: WallSponsor;
  size: "lg" | "md";
  principalLabel?: string;
}) {
  const heightClass = size === "lg" ? "h-32" : "h-24";
  const inner = (
    <div className="relative">
      {size === "lg" && principalLabel ? (
        <Badge
          variant="gold"
          className="absolute -top-2.5 left-1/2 -translate-x-1/2"
        >
          {principalLabel}
        </Badge>
      ) : null}
      <div
        className={`flex ${heightClass} w-full items-center justify-center rounded-lg border p-6 transition-colors ${
          size === "lg"
            ? "border-gold/50 bg-gold/5 group-hover:bg-gold/10"
            : "border-border bg-background group-hover:bg-muted/40"
        }`}
      >
      {sponsor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span
          className={`text-center font-semibold text-muted-foreground ${
            size === "lg" ? "text-lg" : "text-sm"
          }`}
        >
          {sponsor.name}
        </span>
      )}
      </div>
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noreferrer"
        className="group block"
        title={sponsor.name}
      >
        {inner}
      </a>
    );
  }
  return <div className="group">{inner}</div>;
}
