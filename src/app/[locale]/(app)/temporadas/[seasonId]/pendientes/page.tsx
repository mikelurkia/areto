import { notFound } from "next/navigation";
import { ArrowLeftIcon, ShieldHalf } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadSeasonRenewals, type RenewalStatus } from "@/lib/season-renewals";
import { Link } from "@/i18n/navigation";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<RenewalStatus, "secondary" | "warning" | "destructive" | "outline"> = {
  approved: "secondary",
  pending: "warning",
  rejected: "destructive",
  missing: "outline",
};

// "Sin inscripción" y "Rechazada" primero: son a quienes hay que avisar.
const STATUS_ORDER: Record<RenewalStatus, number> = {
  missing: 0,
  rejected: 1,
  pending: 2,
  approved: 3,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
}) {
  const { locale, seasonId } = await params;
  const t = await getTranslations({ locale, namespace: "Temporadas" });
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  return { title: `${t("renewalsPageTitle")} · ${season?.name ?? "Areto"}` };
}

export default async function SeasonRenewalsPage({
  params,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
}) {
  const { locale, seasonId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations("Temporadas");

  const [season, renewals] = await Promise.all([
    db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) }),
    loadSeasonRenewals(seasonId),
  ]);
  if (!season) notFound();

  const rows = [...renewals.rows].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.personName.localeCompare(b.personName, locale);
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Link
          href={`/temporadas/${season.id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("backToSeason")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("renewalsPageTitle")}</h1>
        <p className="text-muted-foreground">
          {season.name} · {t("renewalsPageDescription")}
        </p>
      </div>

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("noRenewalsPendingTitle")}
          description={t("noRenewalsPendingDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colTeam")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colContact")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.personId}>
                <TableCell className="font-medium">
                  <Link href={`/personas/${row.personId}`} className="hover:underline">
                    {row.personName}
                  </Link>
                </TableCell>
                <TableCell>{row.teamName}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{t(`status${capitalize(row.status)}`)}</Badge>
                </TableCell>
                <TableCell>
                  {row.contactPhone || row.contactEmail ? (
                    <div className="flex flex-col text-sm">
                      <span>{row.contactName}</span>
                      <span className="text-muted-foreground">
                        {[row.contactPhone, row.contactEmail].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("noContact")}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
