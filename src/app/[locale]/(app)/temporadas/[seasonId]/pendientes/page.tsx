import { notFound } from "next/navigation";
import { ArrowLeftIcon, MailIcon, MessageCircleIcon, ShieldHalf } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadSeasonRenewals, type RenewalStatus } from "@/lib/season-renewals";
import { mailtoLink, whatsappLink } from "@/lib/contact-links";
import { Link } from "@/i18n/navigation";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Solo tiene sentido avisar de estas dos: son las que no tienen la
// inscripción resuelta (mismo criterio que `missingCount` en season-renewals.ts).
const REMINDABLE_STATUSES: RenewalStatus[] = ["missing", "rejected"];

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
  searchParams,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale, seasonId } = await params;
  const { team: teamFilter } = await searchParams;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations("Temporadas");

  // `loadSeasonRenewals` va en un await aparte: es una agregación con su
  // propio Promise.all interno, y sumarla al de esta página sería el mismo
  // patrón que colgó el dashboard (ver CLAUDE.md).
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  if (!season) notFound();
  const renewals = await loadSeasonRenewals(seasonId);

  const filteredRows = teamFilter
    ? renewals.rows.filter((r) => r.teamId === teamFilter)
    : renewals.rows;
  const filteredTeamName = teamFilter ? filteredRows[0]?.teamName : null;

  const rows = [...filteredRows].sort((a, b) => {
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
          {season.name}
          {filteredTeamName ? ` · ${filteredTeamName}` : ""} · {t("renewalsPageDescription")}
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
              <TableHead>{t("colReminder")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const canRemind = REMINDABLE_STATUSES.includes(row.status);
              const message = t("reminderMessage", {
                contactName: row.contactName,
                personName: row.personName,
                team: row.teamName,
                season: season.name,
              });
              return (
                <TableRow key={row.personId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/personas/${row.personId}?from=${encodeURIComponent(`/temporadas/${season.id}/pendientes`)}&fromLabel=${encodeURIComponent(season.name)}`}
                      className="hover:underline"
                    >
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
                  <TableCell>
                    {canRemind && (row.contactPhone || row.contactEmail) ? (
                      <div className="flex items-center gap-0.5">
                        {row.contactPhone ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            render={
                              <a
                                href={whatsappLink(row.contactPhone, message)}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                            nativeButton={false}
                            title={t("remindWhatsappAction")}
                            aria-label={t("remindWhatsappAction")}
                          >
                            <MessageCircleIcon />
                          </Button>
                        ) : null}
                        {row.contactEmail ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            render={
                              <a
                                href={mailtoLink(
                                  row.contactEmail,
                                  t("reminderEmailSubject", { personName: row.personName }),
                                  message,
                                )}
                              />
                            }
                            nativeButton={false}
                            title={t("remindEmailAction")}
                            aria-label={t("remindEmailAction")}
                          >
                            <MailIcon />
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
