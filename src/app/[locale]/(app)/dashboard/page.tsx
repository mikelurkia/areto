import { Suspense } from "react";
import { connection } from "next/server";
import { and, eq, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  HandshakeIcon,
  Inbox,
  ShieldAlertIcon,
  ShieldHalf,
  TriangleAlertIcon,
  UserCheck,
  Users,
} from "lucide-react";

import { db } from "@/db";
import {
  clubMembers,
  memberships,
  personQualifications,
  persons,
  registrations,
  seasons,
  sponsorshipTerms,
  teams,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { loadDataIntegrityIssues, type IntegrityIssue } from "@/lib/data-integrity";
import { isActivePlayer, isPastMember } from "@/lib/membership";
import { findDuplicatePersonGroups } from "@/lib/person-matching";
import { loadSeasonRenewals } from "@/lib/season-renewals";
import { seasonYearOf } from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import { CardSkeleton, StatCardsSkeleton } from "@/components/skeletons";
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

const playerMembershipSeasonInclude = {
  columns: { role: true },
  with: { team: { columns: {}, with: { season: { columns: { isCurrent: true } } } } },
} as const;

async function getExpiringItems(today: string, cutoff: string): Promise<ExpiringItem[]> {
  const [medicalCerts, qualifications, expiringSponsorships] = await Promise.all([
    db.query.persons.findMany({
      where: and(isNotNull(persons.medicalCertUntil), lte(persons.medicalCertUntil, cutoff)),
      columns: { id: true, firstName: true, lastName: true, medicalCertUntil: true },
      with: { memberships: playerMembershipSeasonInclude },
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
      .filter((p) => isActivePlayer(p.memberships))
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
 * KPIs de la temporada actual: personas activas (con membership en un equipo
 * de la temporada o alta de socio vigente, sin duplicar a quien es ambas
 * cosas), equipos, socios activos e inscripciones pendientes de revisar.
 */
async function getOverviewStats() {
  // Sin esto, el prerender estático (`cacheComponents`) congelaría estos
  // recuentos en la caché en vez de calcularlos en cada petición (ver
  // `expiryWindow` más abajo).
  await connection();
  const currentSeason = await db.query.seasons.findFirst({
    where: eq(seasons.isCurrent, true),
    columns: { id: true },
  });

  const [currentSeasonTeams, activeClubMembers, pendingRegistrations] = await Promise.all([
    currentSeason
      ? db.query.teams.findMany({
          where: eq(teams.seasonId, currentSeason.id),
          columns: { id: true },
        })
      : Promise.resolve([]),
    db.query.clubMembers.findMany({
      where: eq(clubMembers.status, "active"),
      columns: { personId: true },
    }),
    db.query.registrations.findMany({
      where: eq(registrations.status, "pending"),
      columns: { id: true },
    }),
  ]);

  const teamIds = currentSeasonTeams.map((t) => t.id);
  const rosterMemberships =
    teamIds.length > 0
      ? await db.query.memberships.findMany({
          where: inArray(memberships.teamId, teamIds),
          columns: { personId: true },
        })
      : [];

  const activePeopleCount = new Set([
    ...rosterMemberships.map((m) => m.personId),
    ...activeClubMembers.map((m) => m.personId),
  ]).size;

  return {
    peopleCount: activePeopleCount,
    teamsCount: teamIds.length,
    membersCount: activeClubMembers.length,
    pendingRegistrationsCount: pendingRegistrations.length,
  };
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

/**
 * Recuento de grupos de posibles personas duplicadas (mismo cálculo que
 * `/personas/duplicados`, aquí solo hace falta el número de grupos).
 */
async function countDuplicatePersonGroups(): Promise<number> {
  const allPersons = await db.query.persons.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      email: true,
      phone: true,
      iban: true,
    },
  });
  return findDuplicatePersonGroups(allPersons).length;
}

type IntegrityRow =
  | IntegrityIssue
  | { key: "duplicatePersons" | "pendingRenewals"; count: number; severity: "soft"; href: string };

/**
 * Tarjeta de incoherencias de datos: reglas de negocio no forzadas en base de
 * datos (`src/lib/data-integrity.ts`), más dos casos que reutilizan
 * herramientas ya existentes en la app (duplicados de personas, renovaciones
 * de temporada) en vez de reimplementar su lógica.
 */
async function IntegrityCard() {
  // Mismo motivo que en `getOverviewStats`: sin marcar el componente como de
  // tiempo de petición, `cacheComponents` intentaría congelar estas
  // incoherencias en el prerender estático en vez de recalcularlas.
  await connection();
  const [t, currentSeason] = await Promise.all([
    getTranslations("Dashboard"),
    db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true), columns: { id: true } }),
  ]);

  const [issues, duplicatePersonsCount, renewals] = await Promise.all([
    loadDataIntegrityIssues(currentSeason?.id ?? null),
    countDuplicatePersonGroups(),
    currentSeason ? loadSeasonRenewals(currentSeason.id) : Promise.resolve(null),
  ]);

  const rows: IntegrityRow[] = [
    ...issues,
    ...(duplicatePersonsCount > 0
      ? [
          {
            key: "duplicatePersons" as const,
            count: duplicatePersonsCount,
            severity: "soft" as const,
            href: "/personas/duplicados",
          },
        ]
      : []),
    ...(renewals && renewals.missingCount > 0
      ? [
          {
            key: "pendingRenewals" as const,
            count: renewals.missingCount,
            severity: "soft" as const,
            href: `/temporadas/${currentSeason!.id}/pendientes`,
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlertIcon className="size-4" />
          {t("integritySection")}
        </CardTitle>
        <CardDescription>{t("integritySectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noIntegrityIssuesDescription")}</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={row.href} className="font-medium hover:underline">
                {t(`integrity.${row.key}`)}
              </Link>
              <Badge
                variant={row.severity === "hard" ? "destructive" : "warning"}
                className="ml-auto"
              >
                {row.count}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Rejilla de KPIs. Componente propio para poder darle su `<Suspense>`: sus
 * consultas no deben retrasar el resto del panel.
 */
async function StatsRow() {
  const [stats, t] = await Promise.all([getOverviewStats(), getTranslations("Dashboard")]);

  const items = [
    { key: "people", value: stats.peopleCount, icon: Users },
    { key: "teams", value: stats.teamsCount, icon: ShieldHalf },
    { key: "members", value: stats.membersCount, icon: UserCheck },
    { key: "registrations", value: stats.pendingRegistrationsCount, icon: Inbox },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((stat) => (
        <Card key={stat.key}>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <stat.icon className="size-4" />
              {t(`stats.${stat.key}.label`)}
            </CardDescription>
            <CardTitle className="text-3xl">{stat.value}</CardTitle>
            <p className="text-xs text-muted-foreground">{t(`stats.${stat.key}.hint`)}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
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
 * El armazón (título) solo necesita el rol, así que aparece de inmediato y
 * cada sección con consultas propias (KPIs, patrocinio, vencimientos,
 * incoherencias) fluye después, a su ritmo.
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
  const canManage = user
    ? (MANAGE_ROLES as readonly string[]).includes(user.role)
    : false;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {canManage ? (
        <>
          <Suspense fallback={<StatCardsSkeleton count={4} />}>
            <StatsRow />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <SponsorshipCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={8} />}>
            <ExpiringCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={5} />}>
            <IntegrityCard />
          </Suspense>
        </>
      ) : null}
    </div>
  );
}
