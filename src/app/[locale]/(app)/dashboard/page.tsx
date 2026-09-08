import { Suspense } from "react";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  FileTextIcon,
  IdCardIcon,
  ReceiptTextIcon,
  ShieldAlertIcon,
  StethoscopeIcon,
  TrendingUpIcon,
  UserPlusIcon,
  ZapIcon,
} from "lucide-react";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  countExpiringMedicalPlayers,
  countPendingRegistrations,
} from "@/lib/dashboard-alerts";
import { loadMonthlyRegistrationTrend } from "@/lib/dashboard-trends";
import {
  countDuplicatePersonGroups,
  loadDataIntegrityIssues,
  type IntegrityIssueKey,
} from "@/lib/data-integrity";
import { canManageLedger, LEDGERS } from "@/lib/economia";
import { medicalReferenceDates } from "@/lib/medical-panel-rows";
import { loadSeasonRenewals } from "@/lib/season-renewals";
import { TONE_VARIANT } from "@/lib/status-tone";
import { loadUpcomingFixtures } from "@/lib/upcoming-fixtures";
import { Link } from "@/i18n/navigation";
import { AlertTile } from "@/components/dashboard/alert-tile";
import { FixtureBoard } from "@/components/dashboard/fixture-board";
import { RegistrationTrendChart } from "@/components/dashboard/registration-trend-chart";
import { PageHeader } from "@/components/page-header";
import { AlertTilesSkeleton, CardSkeleton } from "@/components/skeletons";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Rejilla de alertas: los cuatro avisos que se atienden a diario. Solo aparecen
 * los que tienen algo pendiente; si no hay ninguno, se dice explícitamente.
 *
 * `connection()` marca el componente como de tiempo de petición antes de leer el
 * reloj (hace falta para el corte de caducidad de los reconocimientos); sin
 * esto, el prerender congelaría "hoy" en el armazón estático
 * (ver next-prerender-current-time).
 */
async function AlertsGrid({ canSeeMedical }: { canSeeMedical: boolean }) {
  await connection();
  const { today, cutoff } = medicalReferenceDates(new Date());

  const [t, registrationCounts, medical, currentSeason] = await Promise.all([
    getTranslations("Dashboard"),
    countPendingRegistrations(),
    canSeeMedical
      ? countExpiringMedicalPlayers(today, cutoff)
      : Promise.resolve({ expired: 0, expiring: 0, total: 0 }),
    db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true), columns: { id: true } }),
  ]);
  // Aparte del `Promise.all` anterior: es una agregación con sus propias
  // queries internas, y sumarla ahí sería el mismo patrón que colgó el
  // dashboard (ver CLAUDE.md).
  const renewals = currentSeason ? await loadSeasonRenewals(currentSeason.id) : null;

  const tiles = [
    registrationCounts.player > 0 && (
      <AlertTile
        key="playerRegistrations"
        href="/inscripciones"
        icon={ClipboardListIcon}
        count={registrationCounts.player}
        label={t("alerts.playerRegistrations")}
        severity="warning"
      />
    ),
    registrationCounts.member > 0 && (
      <AlertTile
        key="memberRegistrations"
        href="/socios"
        icon={UserPlusIcon}
        count={registrationCounts.member}
        label={t("alerts.memberRegistrations")}
        severity="warning"
      />
    ),
    renewals && renewals.missingCount > 0 && (
      <AlertTile
        key="missingRegistrations"
        href={`/temporadas/${currentSeason!.id}/pendientes`}
        icon={IdCardIcon}
        count={renewals.missingCount}
        label={t("alerts.missingRegistrations")}
        severity="warning"
      />
    ),
    medical.total > 0 && (
      <AlertTile
        key="medicalCerts"
        href="/medico?estado=needsUpdate"
        icon={StethoscopeIcon}
        count={medical.total}
        label={t("alerts.medicalCerts")}
        hint={t("alerts.medicalBreakdown", {
          expired: medical.expired,
          expiring: medical.expiring,
        })}
        severity={medical.expired > 0 ? "danger" : "warning"}
      />
    ),
  ].filter(Boolean);

  if (tiles.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <CheckCircle2Icon className="size-6 shrink-0 text-success" aria-hidden />
        <div className="flex flex-col">
          <span className="font-medium">{t("allClearTitle")}</span>
          <span className="text-sm text-muted-foreground">{t("allClearDescription")}</span>
        </div>
      </div>
    );
  }

  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{tiles}</div>;
}

/**
 * Mini-gráfico de inscripciones por mes de la temporada activa. Aparte del
 * resto de secciones (su propio `await`, no metido en un `Promise.all`
 * compartido): es una agregación con su propia consulta, mismo motivo que
 * `renewals` en `AlertsGrid` (ver CLAUDE.md).
 */
async function RegistrationTrendSection({ locale }: { locale: string }) {
  await connection();
  const [t, currentSeason] = await Promise.all([
    getTranslations("Dashboard"),
    db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true), columns: { id: true } }),
  ]);

  if (!currentSeason) return null;

  const trend = await loadMonthlyRegistrationTrend(currentSeason.id);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const chartData = trend.map((point) => {
    const [year, m] = point.month.split("-").map(Number);
    return { ...point, label: monthFormatter.format(new Date(year, m - 1, 1)) };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUpIcon className="size-4" />
          {t("registrationsTrendSection")}
        </CardTitle>
        <CardDescription>{t("registrationsTrendSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <SectionPlaceholder size="compact" title={t("noRegistrationsTrendDescription")} />
        ) : (
          <RegistrationTrendChart
            data={chartData}
            countLabel={t("registrationsTrendCountLabel")}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Atajos al alta de los documentos económicos que se registran a diario. Sin
 * consulta propia: el permiso de gestión ya viaja en `user` desde
 * `getCurrentUser()`, así que no añade ninguna query a la carga del panel.
 */
async function QuickActionsSection() {
  const t = await getTranslations("Dashboard");

  const actions = [
    {
      key: "movement",
      href: "/economia/movimientos?libro=both",
      icon: ArrowRightLeftIcon,
    },
    {
      key: "ticket",
      href: "/economia/tickets?libro=both",
      icon: ReceiptTextIcon,
    },
    {
      key: "invoice",
      href: "/economia/recibidas?libro=both",
      icon: FileTextIcon,
    },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ZapIcon className="size-4" />
          {t("quickActionsSection")}
        </CardTitle>
        <CardDescription>{t("quickActionsSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map(({ key, href, icon: Icon }) => (
          <Button
            key={key}
            variant="secondary"
            nativeButton={false}
            render={<Link href={href} />}
          >
            <Icon data-icon="inline-start" />
            {t(`quickAction_${key}`)}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

type ReviewRowKey = IntegrityIssueKey | "duplicatePersons";

/**
 * Tarjeta de revisión: reglas de negocio no forzadas en base de datos
 * (`src/lib/data-integrity.ts`) más los posibles duplicados de personas. No es
 * trabajo diario, así que va resumida a etiqueta + conteo, sin nombres.
 */
async function ReviewCard() {
  // Mismo motivo que en `AlertsGrid`: sin marcar el componente como de tiempo
  // de petición, `cacheComponents` intentaría congelar estas incoherencias en
  // el prerender estático en vez de recalcularlas.
  await connection();
  const [t, currentSeason] = await Promise.all([
    getTranslations("Dashboard"),
    db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true), columns: { id: true } }),
  ]);

  const [issues, duplicatePersonsCount] = await Promise.all([
    loadDataIntegrityIssues(currentSeason?.id ?? null),
    countDuplicatePersonGroups(),
  ]);

  const rows: { key: ReviewRowKey; count: number; severity: "hard" | "soft"; href: string }[] = [
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
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlertIcon className="size-4" />
          {t("reviewSection")}
        </CardTitle>
        <CardDescription>{t("reviewSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <SectionPlaceholder size="compact" title={t("noReviewDescription")} />
        ) : (
          rows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={row.href} className="font-medium hover:underline">
                {t(`review.${row.key}`)}
              </Link>
              <Badge
                variant={TONE_VARIANT[row.severity === "hard" ? "danger" : "warning"]}
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
 * Cuadro deportivo: el próximo partido de cada equipo. Depende del reloj de la
 * petición (qué partido queda por delante), de ahí el `connection()`.
 */
async function FixtureBoardSection() {
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const [t, fixtures] = await Promise.all([
    getTranslations("Dashboard"),
    loadUpcomingFixtures(today),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDaysIcon className="size-4" />
          {t("fixturesSection")}
        </CardTitle>
        <CardDescription>{t("fixturesSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {fixtures.nextWeekendMissingPreferredDay > 0 ? (
          <Link
            href="/calendario"
            className="flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm font-medium ring-1 ring-warning/40 hover:bg-warning/25"
          >
            {t("fixturesPreferredDayWarning", {
              count: fixtures.nextWeekendMissingPreferredDay,
            })}
          </Link>
        ) : null}
        {fixtures.byCategory.length === 0 ? (
          <SectionPlaceholder size="compact" title={t("noFixturesDescription")} />
        ) : (
          <FixtureBoard byCategory={fixtures.byCategory} />
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
 * El armazón (título) solo necesita el rol, así que aparece de inmediato y cada
 * sección con consultas propias fluye después, a su ritmo. Orden pensado para
 * actuar rápido: primero los atajos de alta, luego las alertas del día, después
 * lo que conviene revisar de vez en cuando, y al final el cuadro de la próxima
 * jornada.
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
  // Cada sección se recorta con su propio permiso: con roles a medida ya no
  // hay un único "puede gestionar" que valga para todas.
  const canSeePersonas = hasPermission(user, "personas.view");
  const canSeeMedical = hasPermission(user, "personas.medical.view");
  const canSeeCalendario = hasPermission(user, "calendario.view");
  const canManageEconomia = LEDGERS.some((ledger) => canManageLedger(user, ledger));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {canManageEconomia ? (
        <Suspense fallback={<CardSkeleton lines={1} />}>
          <QuickActionsSection />
        </Suspense>
      ) : null}

      {canSeePersonas ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangleIcon className="size-4" />
                {t("alertsSection")}
              </CardTitle>
              <CardDescription>{t("alertsSectionHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<AlertTilesSkeleton />}>
                <AlertsGrid canSeeMedical={canSeeMedical} />
              </Suspense>
            </CardContent>
          </Card>
          <Suspense fallback={<CardSkeleton lines={3} />}>
            <ReviewCard />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={1} />}>
            <RegistrationTrendSection locale={locale} />
          </Suspense>
        </>
      ) : null}
      {canSeeCalendario ? (
        <Suspense fallback={<CardSkeleton lines={6} />}>
          <FixtureBoardSection />
        </Suspense>
      ) : null}
    </div>
  );
}
