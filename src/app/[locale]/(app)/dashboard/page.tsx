import { and, eq, isNotNull, lte, ne } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
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

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const user = await getCurrentUser();
  const canSeeExpirations = user
    ? (MANAGE_ROLES as readonly string[]).includes(user.role)
    : false;

  const today = new Date().toISOString().slice(0, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + EXPIRY_WINDOW_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const expiringItems = canSeeExpirations ? await getExpiringItems(today, cutoff) : [];
  const sponsorship = canSeeExpirations ? await getSponsorshipSummary(today) : null;
  const locale = await getLocale();
  const currencyFmt = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });

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

      {sponsorship ? (
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
      ) : null}

      {canSeeExpirations ? (
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
              <p className="text-sm text-muted-foreground">
                {t("noExpiringDescription")}
              </p>
            ) : (
              expiringItems.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
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
                  <Badge
                    variant={item.expired ? "destructive" : "warning"}
                    className="ml-auto"
                  >
                    {item.expired
                      ? t("expiredBadge", { date: item.date })
                      : t("expiresBadge", { date: item.date })}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
