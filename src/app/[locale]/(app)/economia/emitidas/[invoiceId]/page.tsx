import { notFound } from "next/navigation";
import { PaperclipIcon } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, issuedInvoices } from "@/db/schema";
import { linkMovementToIssuedInvoice } from "@/app/[locale]/(app)/economia/emitidas/actions";
import { unlinkMovement } from "@/app/[locale]/(app)/economia/recibidas/actions";
import { IssuedInvoiceDialog } from "@/components/economia/issued-invoice-dialog";
import { IssuedInvoiceStatusActions } from "@/components/economia/issued-invoice-status-actions";
import { MovementLinksPanel } from "@/components/economia/movement-links-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyValue } from "@/components/empty-value";
import { InfoRow } from "@/components/info-row";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  ISSUED_INVOICE_STATUS_TONE,
  canManageLedger,
  canViewLedger,
  invoiceFileBucket,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { getSignedUrl } from "@/lib/supabase/storage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const invoice = await db.query.issuedInvoices.findFirst({
    where: eq(issuedInvoices.id, invoiceId),
    columns: { number: true },
  });
  return { title: invoice ? `${invoice.number} · Areto` : "Areto" };
}

export default async function IssuedInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale, invoiceId } = await params;
  const { from } = await searchParams;
  const backHref = resolveBackHref(from, "/economia/emitidas");
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const invoice = await db.query.issuedInvoices.findFirst({
    where: eq(issuedInvoices.id, invoiceId),
    with: {
      season: { columns: { id: true, name: true } },
      category: { columns: { id: true, name: true } },
      rectifies: { columns: { id: true, number: true } },
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
    getSignedUrl(invoiceFileBucket(invoice.ledger), invoice.filePath),
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
        back={{ href: backHref, label: t("backToIssuedInvoices") }}
        title={invoice.number}
        description={invoice.customerName}
        actions={
          canManage ? (
            <>
              <IssuedInvoiceDialog
                mode="edit"
                invoice={invoice}
                fileName={invoice.fileName}
                fileUrl={fileUrl}
                ledger={invoice.ledger}
                manageableLedgers={visible.filter((l) => canManageLedger(user, l))}
                seasons={[{ id: invoice.season.id, name: invoice.season.name }]}
                categories={
                  invoice.category ? [{ id: invoice.category.id, name: invoice.category.name }] : []
                }
              />
              {invoice.status === "issued" ? (
                <IssuedInvoiceStatusActions id={invoice.id} number={invoice.number} />
              ) : null}
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
            <InfoRow label={t("customerNameLabel")} value={invoice.customerName} />
            <InfoRow
              label={t("customerTaxIdLabel")}
              value={invoice.customerTaxId ?? <EmptyValue />}
            />
            <InfoRow
              label={t("customerAddressLabel")}
              value={invoice.customerAddress ?? <EmptyValue />}
            />
            <InfoRow label={t("movementSeasonLabel")} value={invoice.season.name} />
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
              value={
                <span className="font-semibold">{formatCents(invoice.totalCents, locale)}</span>
              }
            />
            <InfoRow
              label={t("invoiceStatusLabel")}
              value={
                <StatusBadge
                  tone={ISSUED_INVOICE_STATUS_TONE[invoice.status]}
                  label={t(`issuedInvoiceStatus_${invoice.status}`)}
                />
              }
            />
            {invoice.rectifies ? (
              <InfoRow label={t("rectifiesLabel")} value={invoice.rectifies.number} />
            ) : null}
            {invoice.concept ? (
              <InfoRow label={t("conceptLabel")} value={invoice.concept} />
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
              target={{ field: "issuedInvoiceId", id: invoice.id }}
              linkAction={linkMovementToIssuedInvoice}
              unlinkAction={unlinkMovement}
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
