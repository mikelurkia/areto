import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLinkIcon, ReceiptTextIcon, TriangleAlertIcon } from "lucide-react";

import { db } from "@/db";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getPublicUrls, getSignedUrls } from "@/lib/supabase/storage";
import {
  annualEquivalentCents,
  logoThumbPath,
  pickCurrentTerm,
  seasonLabel,
  seasonYearOf,
  sponsorshipStatus,
  SPONSORSHIP_EXPIRY_WINDOW_DAYS,
} from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { ImportSponsorsDialog } from "@/components/patrocinadores/import-sponsors-dialog";
import { SponsorsBrowser } from "@/components/patrocinadores/sponsors-browser";
import { SponsorDialog } from "@/components/patrocinadores/sponsor-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig } from "@/components/ui/chart";
import { TierBreakdownChart } from "@/components/patrocinadores/tier-breakdown-chart";
import { YearlyComparisonChart } from "@/components/patrocinadores/yearly-comparison-chart";

const LOGO_BUCKET = "sponsorship-logos";
const CONTRACT_BUCKET = "sponsorship-contracts";
// La comparativa por temporada solo muestra las últimas N: crece cada año y
// sin límite era ruido puro (ver análisis del módulo).
const YEARLY_CHART_SEASONS = 6;
// Orden categórico fijo (regla de la skill dataviz): nunca reordenar por
// valor, para que el color siga identificando siempre al mismo nivel.
const TIER_CHART_ORDER = ["principal", "colaborador", "publicidad", "none"] as const;
const TIER_CHART_COLORS: Record<(typeof TIER_CHART_ORDER)[number], string> = {
  principal: "var(--chart-1)",
  colaborador: "var(--chart-2)",
  publicidad: "var(--chart-3)",
  none: "var(--chart-4)",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("patrocinadores") };
}

export default async function PatrocinadoresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("patrocinadores.view");
  const canManage = hasPermission(user, "patrocinadores.manage");
  const t = await getTranslations("Patrocinadores");

  // Patrocinadores y personas (para el selector de contacto) no dependen entre
  // sí: en paralelo.
  const [allSponsors, allPersons] = await Promise.all([
    db.query.sponsors.findMany({
      with: { contactPerson: true, terms: { with: { payments: true } } },
      orderBy: (sponsors, { asc }) => [asc(sponsors.name)],
    }),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true },
      orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
    }),
  ]);

  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });

  // El reloj, después de las consultas (ver next-prerender-current-time).
  const today = new Date().toISOString().slice(0, 10);

  // Próximos vencimientos: cobros vencidos/por vencer y acuerdos por vencer,
  // unificados en una sola línea temporal (antes eran dos vistas separadas:
  // la bandeja de cobros aquí y el badge de cada acuerdo en la ficha).
  const upcomingWindowCutoff = new Date();
  upcomingWindowCutoff.setDate(
    upcomingWindowCutoff.getDate() + SPONSORSHIP_EXPIRY_WINDOW_DAYS,
  );
  const upcomingCutoff = upcomingWindowCutoff.toISOString().slice(0, 10);

  type UpcomingItem = {
    id: string;
    kind: "paymentOverdue" | "paymentDue" | "termEnding";
    sponsorId: string;
    sponsorName: string;
    date: string;
    amountCents: number | null;
  };
  const upcomingItems: UpcomingItem[] = [];
  for (const s of allSponsors) {
    for (const term of s.terms) {
      for (const p of term.payments) {
        if (p.status === "paid" || p.status === "waived" || p.dueDate === null) {
          continue;
        }
        if (p.dueDate > upcomingCutoff) continue;
        upcomingItems.push({
          id: `payment-${p.id}`,
          kind: p.dueDate < today ? "paymentOverdue" : "paymentDue",
          sponsorId: s.id,
          sponsorName: s.name,
          date: p.dueDate,
          amountCents: p.amountCents,
        });
      }
      if (
        term.endsOn !== null &&
        term.endsOn >= today &&
        term.endsOn <= upcomingCutoff
      ) {
        upcomingItems.push({
          id: `term-${term.id}`,
          kind: "termEnding",
          sponsorId: s.id,
          sponsorName: s.name,
          date: term.endsOn,
          amountCents: null,
        });
      }
    }
  }
  upcomingItems.sort((a, b) => a.date.localeCompare(b.date));

  // Comparativa por temporada: comprometido vs. cobrado de las anualidades.
  const yearMap = new Map<string, { committedCents: number; collectedCents: number }>();
  for (const s of allSponsors) {
    for (const term of s.terms) {
      for (const p of term.payments) {
        const year = p.year !== null ? seasonLabel(p.year) : t("noDateGroup");
        const entry = yearMap.get(year) ?? { committedCents: 0, collectedCents: 0 };
        entry.committedCents += p.amountCents;
        if (p.status === "paid") entry.collectedCents += p.amountCents;
        yearMap.set(year, entry);
      }
    }
  }
  const yearSummary = [...yearMap.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => b.year.localeCompare(a.year));
  // Gráfico: solo las últimas N temporadas (la tabla no tenía límite y crecía
  // sin fin), en orden cronológico para leer la tendencia de izquierda a
  // derecha.
  const yearlyChartData = yearSummary
    .slice(0, YEARLY_CHART_SEASONS)
    .reverse()
    .map((row) => ({
      year: row.year,
      committed: row.committedCents / 100,
      collected: row.collectedCents / 100,
    }));
  const yearlyChartConfig = {
    committed: { label: t("committedLabel"), color: "var(--chart-1)" },
    collected: { label: t("collectedLabel"), color: "var(--chart-2)" },
  } satisfies ChartConfig;

  // KPIs de la temporada actual (sep–ago) y desglose por nivel.
  const currentSeasonYear = seasonYearOf(today);
  const currentSeasonLabel = seasonLabel(currentSeasonYear);
  const cutoff = upcomingCutoff;

  let seasonCommittedCents = 0;
  let seasonCollectedCents = 0;
  for (const s of allSponsors) {
    for (const term of s.terms) {
      for (const p of term.payments) {
        if (p.year !== currentSeasonYear) continue;
        seasonCommittedCents += p.amountCents;
        if (p.status === "paid") seasonCollectedCents += p.amountCents;
      }
    }
  }
  const collectionRate =
    seasonCommittedCents > 0
      ? Math.round((seasonCollectedCents / seasonCommittedCents) * 100)
      : null;

  const withLogo = allSponsors.filter((s) => s.logoPath);
  const currentTermBySponsor = new Map(
    allSponsors.map((s) => [s.id, pickCurrentTerm(s.terms, today)]),
  );

  // Patrocinadores "activos" esta temporada y desglose por nivel: mismo
  // criterio que el badge del listado (vigente o por vencer, no vencidos).
  const tierAgg = new Map<string, { count: number; amountCents: number }>();
  let activeSponsorsCount = 0;
  for (const term of currentTermBySponsor.values()) {
    if (!term) continue;
    const st = sponsorshipStatus(term.endsOn, today, cutoff);
    if (st !== "active" && st !== "expiringSoon") continue;
    activeSponsorsCount += 1;
    const key = term.tier ?? "none";
    const entry = tierAgg.get(key) ?? { count: 0, amountCents: 0 };
    entry.count += 1;
    entry.amountCents +=
      term.totalAmountCents != null
        ? annualEquivalentCents(term.totalAmountCents, term.startsOn, term.endsOn)
        : 0;
    tierAgg.set(key, entry);
  }
  const tierBreakdown = TIER_CHART_ORDER.filter((key) => tierAgg.has(key)).map(
    (key) => ({ key, ...tierAgg.get(key)! }),
  );
  const tierChartData = tierBreakdown.map((row) => ({
    key: row.key,
    label: row.key === "none" ? t("tierNone") : t(`tier.${row.key}`),
    amount: row.amountCents / 100,
    fill: TIER_CHART_COLORS[row.key],
  }));
  const tierChartConfig = Object.fromEntries(
    TIER_CHART_ORDER.map((key) => [
      key,
      {
        label: key === "none" ? t("tierNone") : t(`tier.${key}`),
        color: TIER_CHART_COLORS[key],
      },
    ]),
  ) satisfies ChartConfig;
  const withContract = [...currentTermBySponsor.values()].filter(
    (term) => term?.contractPath,
  );

  // Listado: solo hace falta el avatar en miniatura, no el logo a tamaño completo.
  const logoUrls = getPublicUrls(
    LOGO_BUCKET,
    withLogo,
    (s) => (s.logoPath ? logoThumbPath(s.logoPath) : null),
    (s) => s.id,
  );
  const contractUrls = await getSignedUrls(
    CONTRACT_BUCKET,
    withContract,
    (term) => term?.contractPath,
    (term) => term!.id,
  );

  const sponsorRows = allSponsors.map((s) => {
    const currentTerm = currentTermBySponsor.get(s.id) ?? null;
    return {
      id: s.id,
      name: s.name,
      contactPersonId: s.contactPersonId,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      websiteUrl: s.websiteUrl,
      fiscalName: s.fiscalName,
      taxId: s.taxId,
      fiscalAddress: s.fiscalAddress,
      notes: s.notes,
      contactPerson: s.contactPerson
        ? { firstName: s.contactPerson.firstName, lastName: s.contactPerson.lastName }
        : null,
      logoUrl: logoUrls.get(s.id) ?? null,
      termsCount: s.terms.length,
      currentTerm: currentTerm
        ? {
            tier: currentTerm.tier,
            totalAmountCents: currentTerm.totalAmountCents,
            startsOn: currentTerm.startsOn,
            endsOn: currentTerm.endsOn,
            contractUrl: contractUrls.get(currentTerm.id) ?? null,
          }
        : null,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* La cabecera entera se oculta al imprimir, no solo las acciones. */}
      <PageHeader
        className="print:hidden"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/patrocinadores/facturas" />}
              nativeButton={false}
            >
              <ReceiptTextIcon data-icon="inline-start" />
              {t("invoiceRegisterLink")}
            </Button>
            <Button
              variant="outline"
              render={
                <Link
                  href="/patrocinadores-muro"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              nativeButton={false}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              {t("publicWallLink")}
            </Button>
            {canManage ? (
              <>
                <ImportSponsorsDialog />
                <SponsorDialog mode="create" personOptions={allPersons} />
              </>
            ) : null}
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("seasonKpisHeading", { season: currentSeasonLabel })}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t("kpiActiveSponsors")}
            value={activeSponsorsCount}
          />
          <StatTile
            label={t("committedLabel")}
            value={currencyFmt.format(seasonCommittedCents / 100)}
          />
          <StatTile
            label={t("collectedLabel")}
            value={currencyFmt.format(seasonCollectedCents / 100)}
          />
          <StatTile
            label={t("kpiCollectionRate")}
            value={collectionRate === null ? "—" : `${collectionRate}%`}
          />
        </div>
      </section>

      {upcomingItems.length > 0 ? (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlertIcon className="size-4" />
              {t("upcomingSection")}
            </CardTitle>
            <CardDescription>
              {t("upcomingSectionHint", { days: SPONSORSHIP_EXPIRY_WINDOW_DAYS })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {upcomingItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/patrocinadores/${item.sponsorId}`}
                  className="font-medium hover:underline"
                >
                  {item.sponsorName}
                </Link>
                {item.amountCents !== null ? (
                  <span className="font-medium">
                    {currencyFmt.format(item.amountCents / 100)}
                  </span>
                ) : null}
                <StatusBadge
                  tone={item.kind === "paymentOverdue" ? "danger" : "warning"}
                  label={t(`upcomingKind.${item.kind}`)}
                  className="ml-auto"
                />
                <span className="text-xs text-muted-foreground">
                  {t(
                    item.kind === "paymentOverdue" ? "overdueSince" : "dueOn",
                    { date: item.date },
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <SponsorsBrowser
        sponsors={sponsorRows}
        personOptions={allPersons}
        locale={locale}
        canManage={canManage}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {tierChartData.length > 0 ? (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">
                {t("tierBreakdownSection")}
              </CardTitle>
              <CardDescription>{t("tierBreakdownHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <TierBreakdownChart
                data={tierChartData}
                config={tierChartConfig}
                locale={locale}
              />
            </CardContent>
          </Card>
        ) : null}

        {yearlyChartData.length > 0 ? (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">{t("yearlyComparisonSection")}</CardTitle>
              <CardDescription>{t("yearlyComparisonHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <YearlyComparisonChart
                data={yearlyChartData}
                config={yearlyChartConfig}
                locale={locale}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
