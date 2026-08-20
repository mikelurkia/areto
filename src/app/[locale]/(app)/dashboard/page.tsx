import { Suspense } from "react";
import { connection } from "next/server";
import { and, eq, isNotNull, lte, ne } from "drizzle-orm";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  HandshakeIcon,
  ListChecks,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { db } from "@/db";
import { personQualifications, persons, registrations, seasons, sponsorshipTerms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { groupCourtEventsByWeekend, loadCourtEvents } from "@/lib/court-events";
import { loadDataIntegrityIssues, type IntegrityIssue } from "@/lib/data-integrity";
import { isActivePlayer, isPastMember } from "@/lib/membership";
import { findDuplicatePersonGroups } from "@/lib/person-matching";
import { loadSeasonRenewals } from "@/lib/season-renewals";
import { seasonYearOf } from "@/lib/sponsorship";
import { categoryRequiresMedicalCheckup } from "@/components/equipos/team-categories";
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

const playerMembershipSeasonInclude = {
  columns: { role: true },
  with: {
    team: {
      columns: { category: true },
      with: { season: { columns: { isCurrent: true } } },
    },
  },
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
      .filter(
        (p) =>
          isActivePlayer(p.memberships) &&
          // Por debajo de cadete no se exige certificado médico, no avisa.
          p.memberships.some(
            (m) => m.team.season.isCurrent && categoryRequiresMedicalCheckup(m.team.category),
          ),
      )
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
 * Inscripciones pendientes de validar, jugador y socio por separado: se
 * revisan en pantallas distintas (`/inscripciones` y `/socios`).
 */
async function getPendingRegistrationCounts() {
  const [pendingPlayerRegistrations, pendingMemberRegistrations] = await Promise.all([
    db.query.registrations.findMany({
      where: and(eq(registrations.kind, "player"), eq(registrations.status, "pending")),
      columns: { id: true },
    }),
    db.query.registrations.findMany({
      where: and(eq(registrations.kind, "member"), eq(registrations.status, "pending")),
      columns: { id: true },
    }),
  ]);
  return {
    pendingPlayerRegistrationsCount: pendingPlayerRegistrations.length,
    pendingMemberRegistrationsCount: pendingMemberRegistrations.length,
  };
}

const WEEKEND_LOOKAHEAD_DAYS = 90;

/**
 * Partidos en casa de la próxima jornada (el fin de semana más próximo con
 * partidos, dentro de los próximos `WEEKEND_LOOKAHEAD_DAYS` días) que
 * todavía no tienen `preferredDay` marcado: hay que avisar con antelación al
 * polideportivo, así que conviene que no pasen desapercibidos. `null` si no
 * hay ningún partido en casa próximo en ese horizonte.
 */
async function getNextWeekendPreferredDayGap(today: string) {
  const lookaheadDate = new Date(`${today}T00:00:00`);
  lookaheadDate.setDate(lookaheadDate.getDate() + WEEKEND_LOOKAHEAD_DAYS);

  const upcoming = await loadCourtEvents({
    from: today,
    to: lookaheadDate.toISOString().slice(0, 10),
  });
  const homeMatches = upcoming.filter((e) => e.isHome === true);
  if (homeMatches.length === 0) return null;

  const groups = groupCourtEventsByWeekend(homeMatches);
  const nextWeekendKey = [...groups.keys()].sort()[0];
  const nextWeekendMatches = groups.get(nextWeekendKey)!;
  const missingCount = nextWeekendMatches.filter((m) => m.preferredDay === null).length;

  return { weekendOf: nextWeekendKey, missingCount };
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
  // Mismo motivo que en `expiryWindow`: sin marcar el componente como de
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

type ActionKey = "playerRegistrations" | "memberRegistrations" | "weekendPreferredDay";

type ActionRow = {
  key: ActionKey;
  count: number;
  href: string;
  params?: Record<string, string>;
};

/**
 * Tarjeta de "por hacer": tareas concretas con una acción clara, a diferencia
 * de un resumen de KPIs que no dice qué hacer con esos números. Combina
 * inscripciones/solicitudes por validar con el aviso de que la próxima
 * jornada no tiene fecha preferente confirmada con el polideportivo.
 */
async function ActionsCard() {
  // Mismo motivo que en `IntegrityCard`: sin esto, `cacheComponents`
  // intentaría congelar estas tareas en el prerender estático.
  await connection();
  const today = new Date().toISOString().slice(0, 10);

  const [t, locale, registrationCounts, weekendGap] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
    getPendingRegistrationCounts(),
    getNextWeekendPreferredDayGap(today),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const rows: ActionRow[] = [
    ...(registrationCounts.pendingPlayerRegistrationsCount > 0
      ? [
          {
            key: "playerRegistrations" as const,
            count: registrationCounts.pendingPlayerRegistrationsCount,
            href: "/inscripciones",
          },
        ]
      : []),
    ...(registrationCounts.pendingMemberRegistrationsCount > 0
      ? [
          {
            key: "memberRegistrations" as const,
            count: registrationCounts.pendingMemberRegistrationsCount,
            href: "/socios",
          },
        ]
      : []),
    ...(weekendGap && weekendGap.missingCount > 0
      ? [
          {
            key: "weekendPreferredDay" as const,
            count: weekendGap.missingCount,
            href: "/calendario",
            params: { date: dateFmt.format(new Date(`${weekendGap.weekendOf}T00:00:00`)) },
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" />
          {t("actionsSection")}
        </CardTitle>
        <CardDescription>{t("actionsSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noActionsDescription")}</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={row.href} className="font-medium hover:underline">
                {t(`actions.${row.key}`, row.params)}
              </Link>
              <Badge variant="warning" className="ml-auto">
                {row.count}
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
 * El armazón (título) solo necesita el rol, así que aparece de inmediato y
 * cada sección con consultas propias (por hacer, incoherencias, vencimientos,
 * patrocinio) fluye después, a su ritmo. Orden pensado para actuar rápido:
 * primero lo accionable (tareas concretas, luego datos a corregir), al final
 * lo informativo (resumen de patrocinio).
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
          <Suspense fallback={<CardSkeleton lines={3} />}>
            <ActionsCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={5} />}>
            <IntegrityCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={8} />}>
            <ExpiringCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <SponsorshipCard />
          </Suspense>
        </>
      ) : null}
    </div>
  );
}
