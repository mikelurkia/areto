import { PaperclipIcon } from "lucide-react";
import { and, eq, lt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, purchaseReceipts } from "@/db/schema";
import { DeletePurchaseReceiptDialog, PurchaseReceiptDialog } from "@/components/economia/purchase-receipt-dialog";
import {
  attachLinkReceipt,
  removeLinkReceipt,
  unlinkMovement,
} from "@/app/[locale]/(app)/economia/recibidas/actions";
import { linkMovementToPurchaseReceipt } from "@/app/[locale]/(app)/economia/tickets/actions";
import { MovementLinksPanel } from "@/components/economia/movement-links-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyValue } from "@/components/empty-value";
import { InfoRow } from "@/components/info-row";
import { PageHeader } from "@/components/page-header";
import { hasPermission, requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import {
  canManageLedger,
  canViewLedger,
  ECONOMIA_VIEW_PERMISSIONS,
  invoiceFileBucket,
  paymentReceiptBucket,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { getSignedUrl } from "@/lib/supabase/storage";
import { MaskedIbanText } from "@/components/masked-iban";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; receiptId: string }>;
}) {
  const { receiptId } = await params;
  const receipt = await db.query.purchaseReceipts.findFirst({
    where: eq(purchaseReceipts.id, receiptId),
    columns: { description: true },
  });
  return { title: receipt ? `${receipt.description} · Areto` : "Areto" };
}

export default async function PurchaseReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; receiptId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale, receiptId } = await params;
  const { from } = await searchParams;
  const backHref = resolveBackHref(from, "/economia/tickets");
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const canViewBanking = hasPermission(user, "personas.banking.view");
  const t = await getTranslations("Economia");

  const receipt = await db.query.purchaseReceipts.findFirst({
    where: eq(purchaseReceipts.id, receiptId),
    with: {
      paidByPerson: { columns: { id: true, firstName: true, lastName: true, iban: true } },
      season: { columns: { id: true, name: true } },
      team: { columns: { id: true, name: true } },
      category: { columns: { id: true, name: true } },
      links: {
        with: { movement: { columns: { concept: true, bookedOn: true } } },
        orderBy: (l, { desc }) => [desc(l.createdAt)],
      },
    },
  });
  if (!receipt || !canViewLedger(user, receipt.ledger)) notFound();

  const canManage = canManageLedger(user, receipt.ledger);
  const visible = visibleLedgers(user);

  const linkedCents = receipt.links.reduce((sum, l) => sum + l.amountCents, 0);
  const remainingCents = receipt.totalCents - linkedCents;

  const [fileUrl, receiptUrls, candidateMovementsRaw] = await Promise.all([
    getSignedUrl(invoiceFileBucket(receipt.ledger), receipt.filePath),
    Promise.all(
      receipt.links.map((l) => getSignedUrl(paymentReceiptBucket(receipt.ledger), l.filePath)),
    ),
    db.query.accountMovements.findMany({
      where: and(
        eq(accountMovements.ledger, receipt.ledger),
        eq(accountMovements.seasonId, receipt.seasonId),
        lt(accountMovements.amountCents, 0),
      ),
      columns: { id: true, concept: true, bookedOn: true, amountCents: true },
    }),
  ]);

  const candidateMovements = [...candidateMovementsRaw].sort((a, b) => {
    const diffA = Math.abs(Math.abs(a.amountCents) - remainingCents);
    const diffB = Math.abs(Math.abs(b.amountCents) - remainingCents);
    if (diffA !== diffB) return diffA - diffB;
    return b.bookedOn.localeCompare(a.bookedOn);
  });

  const linkRows = receipt.links.map((l, index) => ({
    id: l.id,
    movementId: l.movementId,
    amountCents: l.amountCents,
    movementConcept: l.movement.concept,
    movementBookedOn: l.movement.bookedOn,
    fileUrl: receiptUrls[index],
    fileName: l.fileName,
  }));

  const paidByName = receipt.paidByPerson
    ? `${receipt.paidByPerson.firstName} ${receipt.paidByPerson.lastName}`.trim()
    : "";
  const paidByIban = canViewBanking ? (receipt.paidByPerson?.iban ?? null) : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        size="compact"
        back={{ href: backHref, label: t("backToTickets") }}
        title={receipt.description}
        description={paidByName || undefined}
        actions={
          canManage ? (
            <>
              <PurchaseReceiptDialog
                mode="edit"
                receipt={receipt}
                fileName={receipt.fileName}
                fileUrl={fileUrl}
                ledger={receipt.ledger}
                manageableLedgers={visible.filter((l) => canManageLedger(user, l))}
                seasons={[{ id: receipt.season.id, name: receipt.season.name }]}
                teams={receipt.team ? [{ id: receipt.team.id, name: receipt.team.name }] : []}
                categories={
                  receipt.category ? [{ id: receipt.category.id, name: receipt.category.name }] : []
                }
                personOptions={
                  receipt.paidByPerson
                    ? [
                        {
                          id: receipt.paidByPerson.id,
                          firstName: receipt.paidByPerson.firstName,
                          lastName: receipt.paidByPerson.lastName,
                        },
                      ]
                    : []
                }
              />
              <DeletePurchaseReceiptDialog id={receipt.id} description={receipt.description} />
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
            <InfoRow label={t("ticketPaidByLabel")} value={paidByName || <EmptyValue />} />
            {receipt.paidByPerson ? (
              <InfoRow
                label={t("accountIbanLabel")}
                value={paidByIban ? <MaskedIbanText value={paidByIban} /> : <EmptyValue />}
              />
            ) : null}
            <InfoRow label={t("movementSeasonLabel")} value={receipt.season.name} />
            <InfoRow label={t("invoiceTeamLabel")} value={receipt.team?.name ?? <EmptyValue />} />
            <InfoRow label={t("categoryLabel")} value={receipt.category?.name ?? <EmptyValue />} />
            <InfoRow label={t("ticketPurchasedOnLabel")} value={receipt.purchasedOn} />
            <InfoRow
              label={t("invoiceTotalLabel")}
              value={<span className="font-semibold">{formatCents(receipt.totalCents, locale)}</span>}
            />
            {receipt.notes ? <InfoRow label={t("notesLabel")} value={receipt.notes} /> : null}
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <PaperclipIcon className="size-3.5" />
                {receipt.fileName ?? t("invoiceFileLabel")}
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
              target={{ field: "purchaseReceiptId", id: receipt.id }}
              linkAction={linkMovementToPurchaseReceipt}
              unlinkAction={unlinkMovement}
              attachReceiptAction={attachLinkReceipt}
              removeReceiptAction={removeLinkReceipt}
              totalCents={receipt.totalCents}
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
