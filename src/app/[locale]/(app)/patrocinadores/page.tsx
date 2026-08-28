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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const LOGO_BUCKET = "sponsorship-logos";
const CONTRACT_BUCKET = "sponsorship-contracts";

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

  // Bandeja de vencidos: cobros con vencimiento pasado y aún sin cobrar.
  const overduePayments = allSponsors
    .flatMap((s) =>
      s.terms.flatMap((term) =>
        term.payments
          .filter(
            (p) =>
              p.status !== "paid" &&
              p.status !== "waived" &&
              p.dueDate !== null &&
              p.dueDate < today,
          )
          .map((p) => ({
            id: p.id,
            sponsorId: s.id,
            sponsorName: s.name,
            amountCents: p.amountCents,
            dueDate: p.dueDate!,
          })),
      ),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

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

  // KPIs de la temporada actual (sep–ago) y desglose por nivel.
  const currentSeasonYear = seasonYearOf(today);
  const currentSeasonLabel = seasonLabel(currentSeasonYear);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + SPONSORSHIP_EXPIRY_WINDOW_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

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
  const tierBreakdown = (["principal", "colaborador", "publicidad", "none"] as const)
    .filter((key) => tierAgg.has(key))
    .map((key) => ({ key, ...tierAgg.get(key)! }));
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

      {overduePayments.length > 0 ? (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlertIcon className="size-4" />
              {t("overdueSection")}
            </CardTitle>
            <CardDescription>{t("overdueSectionHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {overduePayments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/patrocinadores/${p.sponsorId}`}
                  className="font-medium hover:underline"
                >
                  {p.sponsorName}
                </Link>
                <span className="font-medium">{currencyFmt.format(p.amountCents / 100)}</span>
                <Badge variant="destructive" className="ml-auto">
                  {t("overdueSince", { date: p.dueDate })}
                </Badge>
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
        {tierBreakdown.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("tierBreakdownSection")}
              </CardTitle>
              <CardDescription>{t("tierBreakdownHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <div className="grid grid-cols-3 border-b pb-1 text-xs text-muted-foreground">
                <span>{t("tierLabel")}</span>
                <span className="text-right">{t("kpiActiveSponsors")}</span>
                <span className="text-right">{t("committedLabel")}</span>
              </div>
              {tierBreakdown.map((row) => (
                <div key={row.key} className="grid grid-cols-3 text-sm">
                  <span className="font-medium">
                    {row.key === "none" ? t("tierNone") : t(`tier.${row.key}`)}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {row.count}
                  </span>
                  <span className="text-right">
                    {currencyFmt.format(row.amountCents / 100)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {yearSummary.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("yearlyComparisonSection")}</CardTitle>
              <CardDescription>{t("yearlyComparisonHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <div className="grid grid-cols-3 border-b pb-1 text-xs text-muted-foreground">
                <span>{t("yearLabel")}</span>
                <span className="text-right">{t("committedLabel")}</span>
                <span className="text-right">{t("collectedLabel")}</span>
              </div>
              {yearSummary.map((row) => (
                <div key={row.year} className="grid grid-cols-3 text-sm">
                  <span className="font-medium">{row.year}</span>
                  <span className="text-right">
                    {currencyFmt.format(row.committedCents / 100)}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {currencyFmt.format(row.collectedCents / 100)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
