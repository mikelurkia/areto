import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { sepaCharges } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { CreateRemittanceDialog } from "@/components/cuotas/create-remittance-dialog";
import { DeleteRemittanceDialog } from "@/components/cuotas/delete-remittance-dialog";
import { DownloadRemittanceXmlButton } from "@/components/cuotas/download-remittance-xml-button";
import { GenerateMemberChargesButton } from "@/components/cuotas/generate-member-charges-button";
import { GeneratePlayerChargesDialog } from "@/components/cuotas/generate-player-charges-dialog";
import { PendingChargeGroupCard } from "@/components/cuotas/pending-charge-group-card";
import { formatCents } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("cuotas") };
}

export default async function CuotasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("cuotas.view");
  const canManage = hasPermission(user, "cuotas.manage");
  const t = await getTranslations("Cuotas");

  const currentSeason = await db.query.seasons.findFirst({
    where: (seasons, { eq }) => eq(seasons.isCurrent, true),
  });

  const [teams, remittances, chargeStats, unassignedCharges] = await Promise.all([
    currentSeason
      ? db.query.teams.findMany({
          where: (teams, { eq }) => eq(teams.seasonId, currentSeason.id),
          orderBy: (teams, { asc }) => [asc(teams.name)],
        })
      : Promise.resolve([]),
    db.query.sepaRemittances.findMany({
      with: { team: true, season: true, charges: true },
      orderBy: (sepaRemittances, { desc }) => [desc(sepaRemittances.generatedAt)],
    }),
    db
      .select({ status: sepaCharges.status, amountCents: sepaCharges.amountCents })
      .from(sepaCharges),
    db.query.sepaCharges.findMany({
      where: (sepaCharges, { and, eq, isNull }) =>
        and(eq(sepaCharges.status, "pending"), isNull(sepaCharges.remittanceId)),
      with: {
        membership: {
          with: {
            team: { columns: { name: true } },
            person: { columns: { firstName: true, lastName: true } },
          },
        },
        clubMember: {
          with: { person: { columns: { firstName: true, lastName: true } } },
        },
      },
    }),
  ]);


  const statTotals = { pending: 0, collected: 0, returned: 0 };
  for (const charge of chargeStats) {
    statTotals[charge.status] += charge.amountCents;
  }

  const teamOptions = teams.map((team) => ({ id: team.id, label: team.name }));

  const pendingGroups = new Map<
    string,
    {
      subject: string;
      periodKey: string;
      amountCents: number;
      rows: { id: string; personName: string; amountCents: number }[];
    }
  >();
  for (const charge of unassignedCharges) {
    const subject = charge.kind === "player" ? (charge.membership?.team?.name ?? "—") : t("kindMember");
    const personName =
      charge.kind === "player"
        ? charge.membership
          ? `${charge.membership.person.firstName} ${charge.membership.person.lastName}`
          : "—"
        : charge.clubMember
          ? `${charge.clubMember.person.firstName} ${charge.clubMember.person.lastName}`
          : "—";
    const key = `${charge.kind}:${subject}:${charge.periodKey}`;
    const group = pendingGroups.get(key) ?? {
      subject,
      periodKey: charge.periodKey,
      amountCents: 0,
      rows: [] as { id: string; personName: string; amountCents: number }[],
    };
    group.amountCents += charge.amountCents;
    group.rows.push({ id: charge.id, personName, amountCents: charge.amountCents });
    pendingGroups.set(key, group);
  }
  const pendingGroupRows = [...pendingGroups.values()].sort((a, b) =>
    a.subject === b.subject ? a.periodKey.localeCompare(b.periodKey) : a.subject.localeCompare(b.subject),
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage && currentSeason ? (
            <>
              <GeneratePlayerChargesDialog seasonId={currentSeason.id} teamOptions={teamOptions} />
              <GenerateMemberChargesButton seasonId={currentSeason.id} />
              <CreateRemittanceDialog seasonId={currentSeason.id} teamOptions={teamOptions} />
            </>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label={t("stat.pending")} value={formatCents(statTotals.pending, locale)} />
        <StatTile label={t("stat.collected")} value={formatCents(statTotals.collected, locale)} />
        <StatTile label={t("stat.returned")} value={formatCents(statTotals.returned, locale)} />
      </div>

      {pendingGroupRows.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionHeading title={t("pendingChargesHeading")} />
          <div className="flex flex-col gap-2">
            {pendingGroupRows.map((group) => (
              <PendingChargeGroupCard
                key={`${group.subject}:${group.periodKey}`}
                subject={group.subject}
                periodKey={group.periodKey}
                amountCents={group.amountCents}
                rows={group.rows}
                canManage={canManage}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </div>
      ) : null}

      {remittances.length === 0 ? (
        <SectionPlaceholder title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colKind")}</TableHead>
              <TableHead priority="secondary">{t("colMessageId")}</TableHead>
              <TableHead priority="tertiary">{t("colCollectionDate")}</TableHead>
              <TableHead className="text-right">{t("colChargeCount")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remittances.map((remittance) => {
              const total = remittance.charges.reduce((sum, c) => sum + c.amountCents, 0);
              const subject =
                remittance.kind === "player"
                  ? (remittance.team?.name ?? t("colKind"))
                  : t("kindMember");
              return (
                <TableRow key={remittance.id}>
                  <TableCell className="font-medium">
                    <Link href={`/cuotas/${remittance.id}`} className="hover:underline">
                      {subject}
                    </Link>
                  </TableCell>
                  <TableCell priority="secondary" className="text-muted-foreground">
                    {remittance.messageId}
                  </TableCell>
                  <TableCell priority="tertiary" nowrap>
                    {remittance.collectionDate}
                  </TableCell>
                  <TableCell className="text-right">{remittance.charges.length}</TableCell>
                  <TableCell nowrap className="text-right font-medium">
                    {formatCents(total, locale)}
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <DownloadRemittanceXmlButton remittanceId={remittance.id} />
                    {canManage ? (
                      <DeleteRemittanceDialog id={remittance.id} messageId={remittance.messageId} />
                    ) : null}
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
