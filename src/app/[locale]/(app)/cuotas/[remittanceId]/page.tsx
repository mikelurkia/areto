import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { sepaRemittances } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { DeleteRemittanceDialog } from "@/components/cuotas/delete-remittance-dialog";
import { DownloadRemittanceXmlButton } from "@/components/cuotas/download-remittance-xml-button";
import { MarkRemittanceCollectedButton } from "@/components/cuotas/mark-remittance-collected-button";
import { formatCents } from "@/lib/money";
import {
  RemittanceChargesTable,
  type ChargeRow,
} from "@/components/cuotas/remittance-charges-table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; remittanceId: string }>;
}) {
  const { locale, remittanceId } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const remittance = await db.query.sepaRemittances.findFirst({
    where: eq(sepaRemittances.id, remittanceId),
  });
  return { title: `${t("cuotas")}${remittance ? ` — ${remittance.messageId}` : ""}` };
}

export default async function RemittanceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; remittanceId: string }>;
}) {
  const { locale, remittanceId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("cuotas.view");
  const canManage = hasPermission(user, "cuotas.manage");
  const t = await getTranslations("Cuotas");

  const remittance = await db.query.sepaRemittances.findFirst({
    where: eq(sepaRemittances.id, remittanceId),
    with: {
      team: true,
      season: true,
      charges: {
        with: {
          mandate: { columns: { rum: true } },
          payer: { columns: { firstName: true, lastName: true } },
          membership: {
            with: { person: { columns: { firstName: true, lastName: true } } },
          },
          clubMember: {
            with: { person: { columns: { firstName: true, lastName: true } } },
          },
        },
        orderBy: (sepaCharges, { asc }) => [asc(sepaCharges.createdAt)],
      },
    },
  });
  if (!remittance) notFound();

  const totalCents = remittance.charges.reduce((sum, c) => sum + c.amountCents, 0);
  const pendingCount = remittance.charges.filter((c) => c.status === "pending").length;
  const subject =
    remittance.kind === "player" ? (remittance.team?.name ?? t("kindPlayer")) : t("kindMember");

  const chargeRows: ChargeRow[] = remittance.charges.map((charge) => {
    const subjectPerson =
      charge.kind === "player" ? charge.membership?.person : charge.clubMember?.person;
    return {
      id: charge.id,
      payerName: `${charge.payer.firstName} ${charge.payer.lastName}`,
      subjectName: subjectPerson
        ? `${subjectPerson.firstName} ${subjectPerson.lastName}`
        : "—",
      amountCents: charge.amountCents,
      status: charge.status,
      rum: charge.mandate.rum,
      returnReason: charge.returnReason,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        size="compact"
        back={{ href: "/cuotas", label: t("title") }}
        title={`${subject} — ${remittance.messageId}`}
        description={t("collectionDateLabel") + ": " + remittance.collectionDate}
        actions={
          <>
            <DownloadRemittanceXmlButton remittanceId={remittance.id} />
            {canManage && pendingCount > 0 ? (
              <MarkRemittanceCollectedButton remittanceId={remittance.id} />
            ) : null}
            {canManage ? (
              <DeleteRemittanceDialog id={remittance.id} messageId={remittance.messageId} />
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label={t("colChargeCount")} value={remittance.charges.length} />
        <StatTile label={t("colAmount")} value={formatCents(totalCents, locale)} />
        <StatTile label={t("stat.pending")} value={pendingCount} />
      </div>

      <RemittanceChargesTable charges={chargeRows} locale={locale} canManage={canManage} />
    </div>
  );
}
