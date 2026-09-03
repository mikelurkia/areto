import { PaperclipIcon } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, receivedInvoices } from "@/db/schema";
import { DeleteReceivedInvoiceDialog, ReceivedInvoiceDialog } from "@/components/economia/received-invoice-dialog";
import { MovementLinksPanel } from "@/components/economia/movement-links-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyValue } from "@/components/empty-value";
import { InfoRow } from "@/components/info-row";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import {
  canManageLedger,
  canViewLedger,
  ECONOMIA_VIEW_PERMISSIONS,
  RECEIVED_INVOICE_STATUS_TONE,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { getSignedUrl } from "@/lib/supabase/storage";

function fileBucket(ledger: "official" | "internal"): string {
  return ledger === "internal" ? "invoice-files-internal" : "invoice-files";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const invoice = await db.query.receivedInvoices.findFirst({
    where: eq(receivedInvoices.id, invoiceId),
    columns: { invoiceNumber: true },
  });
  return { title: invoice ? `${invoice.invoiceNumber} · Areto` : "Areto" };
}

export default async function ReceivedInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale, invoiceId } = await params;
  const { from } = await searchParams;
  const backHref = resolveBackHref(from, "/economia/recibidas");
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const invoice = await db.query.receivedInvoices.findFirst({
    where: eq(receivedInvoices.id, invoiceId),
    with: {
      supplier: { columns: { id: true, name: true } },
      season: { columns: { id: true, name: true } },
      team: { columns: { id: true, name: true } },
      category: { columns: { id: true, name: true } },
      links: {
        with: { movement: { columns: { concept: true, bookedOn: true } } },
        orderBy: (l, { desc }) => [desc(l.createdAt)],
      },
    },
  });
  if (!invoice || !canViewLedger(user, invoice.ledger)) notFound();

  const canManage = canManageLedger(user, invoice.ledger);
  const visible = visibleLedgers(user);

  const [fileUrl, candidateMovements] = await Promise.all([
    getSignedUrl(fileBucket(invoice.ledger), invoice.filePath),
    db.query.accountMovements.findMany({
      where: and(
        eq(accountMovements.ledger, invoice.ledger),
        eq(accountMovements.seasonId, invoice.seasonId),
      ),
      columns: { id: true, concept: true, bookedOn: true, amountCents: true },
      orderBy: (m, { desc }) => [desc(m.bookedOn)],
    }),
  ]);

  const linkRows = invoice.links.map((l) => ({
    id: l.id,
    movementId: l.movementId,
    amountCents: l.amountCents,
    movementConcept: l.movement.concept,
    movementBookedOn: l.movement.bookedOn,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        size="compact"
        back={{ href: backHref, label: t("backToInvoices") }}
        title={invoice.invoiceNumber}
        description={invoice.supplier.name}
        actions={
          canManage ? (
            <>
              <ReceivedInvoiceDialog
                mode="edit"
                invoice={invoice}
                fileName={invoice.fileName}
                fileUrl={fileUrl}
                ledger={invoice.ledger}
                manageableLedgers={visible.filter((l) => canManageLedger(user, l))}
                suppliers={[{ id: invoice.supplier.id, name: invoice.supplier.name }]}
                seasons={[{ id: invoice.season.id, name: invoice.season.name }]}
                teams={invoice.team ? [{ id: invoice.team.id, name: invoice.team.name }] : []}
                categories={invoice.category ? [{ id: invoice.category.id, name: invoice.category.name }] : []}
              />
              <DeleteReceivedInvoiceDialog id={invoice.id} number={invoice.invoiceNumber} />
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("invoiceDetailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <InfoRow label={t("invoiceSupplierLabel")} value={invoice.supplier.name} />
            <InfoRow label={t("movementSeasonLabel")} value={invoice.season.name} />
            <InfoRow label={t("invoiceTeamLabel")} value={invoice.team?.name ?? <EmptyValue />} />
            <InfoRow label={t("categoryLabel")} value={invoice.category?.name ?? <EmptyValue />} />
            <InfoRow label={t("invoiceIssuedOnLabel")} value={invoice.issuedOn} />
            <InfoRow label={t("invoiceDueDateLabel")} value={invoice.dueDate ?? <EmptyValue />} />
            <InfoRow label={t("invoiceBaseLabel")} value={formatCents(invoice.baseCents, locale)} />
            <InfoRow label={t("invoiceVatLabel")} value={formatCents(invoice.vatCents, locale)} />
            <InfoRow
              label={t("invoiceWithholdingLabel")}
              value={formatCents(invoice.withholdingCents, locale)}
            />
            <InfoRow
              label={t("invoiceTotalLabel")}
              value={<span className="font-semibold">{formatCents(invoice.totalCents, locale)}</span>}
            />
            <InfoRow
              label={t("invoiceStatusLabel")}
              value={
                <StatusBadge
                  tone={RECEIVED_INVOICE_STATUS_TONE[invoice.status]}
                  label={t(`invoiceStatus_${invoice.status}`)}
                />
              }
            />
            {invoice.description ? (
              <InfoRow label={t("invoiceDescriptionLabel")} value={invoice.description} />
            ) : null}
            {invoice.notes ? <InfoRow label={t("notesLabel")} value={invoice.notes} /> : null}
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <PaperclipIcon className="size-3.5" />
                {invoice.fileName ?? t("invoiceFileLabel")}
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("reconciliationTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementLinksPanel
              receivedInvoiceId={invoice.id}
              totalCents={invoice.totalCents}
              links={linkRows}
              candidates={candidateMovements}
              locale={locale}
              canManage={canManage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
