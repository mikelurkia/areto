import { Suspense } from "react";
import { connection } from "next/server";
import { and, eq, isNotNull, lte, ne } from "drizzle-orm";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, HandshakeIcon, ShieldHalf, TriangleAlertIcon, Users, Wallet } from "lucide-react";

import { db } from "@/db";
import {
  personQualifications,
  persons,
  seasons,
  sponsorshipTerms,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPastMember } from "@/lib/membership";
import { seasonYearOf } from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import { CardSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MANAGE_ROLES = ["admin", "staff"] as const;
const EXPIRY_WINDOW_DAYS = 60;

type ExpiringItem = {
  key: string;
  href: string;
  label: string;
  type: "medical" | "qualification" | "sponsorship";
  detail?: string;
  date: string;
  expired: boolean;
};

const membershipSeasonInclude = {
  columns: {},
  with: { team: { columns: {}, with: { season: { columns: { isCurrent: true } } } } },
} as const;

async function getExpiringItems(today: string, cutoff: string): Promise<ExpiringItem[]> {
  const [medicalCerts, qualifications, expiringSponsorships] = await Promise.all([
    db.query.persons.findMany({
      where: and(isNotNull(persons.medicalCertUntil), lte(persons.medicalCertUntil, cutoff)),
      columns: { id: true, firstName: true, lastName: true, medicalCertUntil: true },
      with: { memberships: membershipSeasonInclude },
    }),
    db.query.personQualifications.findMany({
      where: and(
        isNotNull(personQualifications.expiresOn),
        lte(personQualifications.expiresOn, cutoff),
      ),
      columns: { id: true, title: true, expiresOn: true },
      with: {
        person: {
          columns: { id: true, firstName: true, lastName: true },
          with: { memberships: membershipSeasonInclude },
        },
      },
    }),
    db.query.sponsorshipTerms.findMany({
      where: and(isNotNull(sponsorshipTerms.endsOn), lte(sponsorshipTerms.endsOn, cutoff)),
      columns: { id: true, endsOn: true },
      with: { sponsor: { columns: { id: true, name: true } } },
    }),
  ]);

  const items: ExpiringItem[] = [
    ...medicalCerts
      .filter((p) => !isPastMember(p.memberships))
      .map((p) => ({
        key: `medical-${p.id}`,
        href: `/personas/${p.id}`,
        label: `${p.firstName} ${p.lastName}`,
        type: "medical" as const,
        date: p.medicalCertUntil!,
        expired: p.medicalCertUntil! < today,
      })),
    ...qualifications
      .filter((q) => !isPastMember(q.person.memberships))
      .map((q) => ({
        key: `qualification-${q.id}`,
        href: `/personas/${q.person.id}`,
        label: `${q.person.firstName} ${q.person.lastName}`,
        type: "qualification" as const,
        detail: q.title,
        date: q.expiresOn!,
        expired: q.expiresOn! < today,
      })),
    ...expiringSponsorships.map((term) => ({
      key: `sponsorship-${term.id}`,
      href: `/patrocinadores/${term.sponsor.id}`,
      label: term.sponsor.name,
      type: "sponsorship" as const,
      date: term.endsOn!,
      expired: term.endsOn! < today,
    })),
  ];

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Resumen de patrocinio de la temporada actual: comprometido (anualidades de
 * la temporada actual en acuerdos no perdidos), cobrado (anualidades pagadas) y
 * pendiente. La temporada actual se toma de `seasons.startsOn`; si no hay
 * temporada marcada, se deduce de la fecha de hoy.
 */
async function getSponsorshipSummary(today: string) {
  const [currentSeason, terms] = await Promise.all([
    db.query.seasons.findFirst({
      where: eq(seasons.isCurrent, true),
      columns: { startsOn: true },
    }),
    db.query.sponsorshipTerms.findMany({
      where: ne(sponsorshipTerms.agreementStatus, "lost"),
      columns: {},
      with: { payments: { columns: { amountCents: true, status: true, year: true } } },
    }),
  ]);

  const currentYear = currentSeason?.startsOn
    ? seasonYearOf(currentSeason.startsOn)
    : seasonYearOf(today);

  const annualities = terms
    .flatMap((t) => t.payments)
    .filter((p) => p.year === currentYear);
  const committedCents = annualities.reduce((sum, p) => sum + p.amountCents, 0);
  const collectedCents = annualities
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amountCents, 0);
  return { committedCents, collectedCents, pendingCents: committedCents - collectedCents };
}

/**
 * Ventana de vencimientos: hoy y la fecha límite de aviso.
 *
 * `connection()` marca el componente como de tiempo de petición antes de leer el
 * reloj. Aquí la fecha hace falta *para construir* la consulta, así que no se
 * puede posponer; sin esto, el prerender congelaría "hoy" en el armazón estático
 * (ver next-prerender-current-time).
 */
async function expiryWindow() {
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + EXPIRY_WINDOW_DAYS);
  return { today, cutoff: cutoffDate.toISOString().slice(0, 10) };
}

/**
 * Tarjeta de patrocinio. Componente propio para poder darle su <Suspense>: sus
 * consultas no deben retrasar el resto del panel.
 */
async function SponsorshipCard() {
  const { today } = await expiryWindow();
  const [sponsorship, t, locale] = await Promise.all([
    getSponsorshipSummary(today),
    getTranslations("Dashboard"),
    getLocale(),
  ]);
  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandshakeIcon className="size-4" />
          {t("sponsorshipSection")}
        </CardTitle>
        <CardDescription>{t("sponsorshipSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("sponsorshipCommitted")}</p>
          <p className="text-2xl font-semibold">
            {currencyFmt.format(sponsorship.committedCents / 100)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("sponsorshipCollected")}</p>
          <p className="text-2xl font-semibold">
            {currencyFmt.format(sponsorship.collectedCents / 100)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("sponsorshipPending")}</p>
          <p className="text-2xl font-semibold">
            {currencyFmt.format(sponsorship.pendingCents / 100)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Tarjeta de vencimientos próximos. Es la parte más lenta del panel (tres
 * consultas y un filtrado por membresías activas), así que fluye aparte.
 */
async function ExpiringCard() {
  const { today, cutoff } = await expiryWindow();
  const [expiringItems, t] = await Promise.all([
    getExpiringItems(today, cutoff),
    getTranslations("Dashboard"),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TriangleAlertIcon className="size-4" />
          {t("expiringSection")}
        </CardTitle>
        <CardDescription>
          {t("expiringSectionHint", { days: EXPIRY_WINDOW_DAYS })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {expiringItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExpiringDescription")}</p>
        ) : (
          expiringItems.map((item) => (
            <div key={item.key} className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={item.href} className="font-medium hover:underline">
                {item.label}
              </Link>
              <span className="text-muted-foreground">
                {item.type === "medical"
                  ? t("expiringMedicalCertLabel")
                  : item.type === "sponsorship"
                    ? t("expiringSponsorshipLabel")
                    : item.detail}
              </span>
              <Badge variant={item.expired ? "destructive" : "warning"} className="ml-auto">
                {item.expired
                  ? t("expiredBadge", { date: item.date })
                  : t("expiresBadge", { date: item.date })}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("dashboard") };
}

/**
 * El armazón (título y KPIs) solo necesita el rol, así que aparece de inmediato
 * y las dos tarjetas con consultas fluyen después, cada una a su ritmo.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);

  const [t, user] = await Promise.all([
    getTranslations("Dashboard"),
    getCurrentUser(),
  ]);
  const canSeeExpirations = user
    ? (MANAGE_ROLES as readonly string[]).includes(user.role)
    : false;

  const stats = [
    { key: "people", value: "—", icon: Users },
    { key: "teams", value: "—", icon: ShieldHalf },
    { key: "events", value: "—", icon: CalendarDays },
    { key: "fees", value: "—", icon: Wallet },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <stat.icon className="size-4" />
                {t(`stats.${stat.key}.label`)}
              </CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t(`stats.${stat.key}.hint`)}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {canSeeExpirations ? (
        <>
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <SponsorshipCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={8} />}>
            <ExpiringCard />
          </Suspense>
        </>
      ) : null}
    </div>
  );
}
