import { CheckCircleIcon } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { purchaseReceipts, receivedInvoices, seasons } from "@/db/schema";
import {
  markPurchaseReceiptPaid,
  unmarkPurchaseReceiptPaid,
} from "@/app/[locale]/(app)/economia/tickets/actions";
import {
  markReceivedInvoicePaid,
  unmarkReceivedInvoicePaid,
} from "@/app/[locale]/(app)/economia/recibidas/actions";
import { markPendingPaidBulk } from "@/app/[locale]/(app)/economia/pagos/actions";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { PagosTable, type PagosRow } from "@/components/economia/pagos-table";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { SeasonSelect } from "@/components/equipos/season-select";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getSignedUrl } from "@/lib/supabase/storage";
import {
  canManageLedger,
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  ledgersForFilter,
  reconciliationState,
  resolveLedgerFilter,
  visibleLedgers,
  invoiceFileBucket,
} from "@/lib/economia";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaPagos") };
}

export default async function PagosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string; season?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const canViewBanking = hasPermission(user, "personas.banking.view");
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);

  const [query, allSeasons] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
  ]);

  const filter = resolveLedgerFilter(query[LEDGER_PARAM], visible)!;
  const ledgers = ledgersForFilter(filter, visible);
  const season =
    allSeasons.find((s) => s.id === query.season) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const pendingInvoices = season
    ? await db.query.receivedInvoices.findMany({
        where: and(
          inArray(receivedInvoices.ledger, ledgers),
          eq(receivedInvoices.seasonId, season.id),
          eq(receivedInvoices.status, "pending"),
        ),
        orderBy: [desc(receivedInvoices.dueDate)],
        with: {
          supplier: { columns: { name: true, iban: true } },
          links: { columns: { amountCents: true } },
        },
      })
    : [];

  const receipts = season
    ? await db.query.purchaseReceipts.findMany({
        where: and(
          inArray(purchaseReceipts.ledger, ledgers),
          eq(purchaseReceipts.seasonId, season.id),
        ),
        orderBy: [desc(purchaseReceipts.purchasedOn)],
        with: {
          paidByPerson: { columns: { firstName: true, lastName: true, iban: true } },
          links: { columns: { amountCents: true } },
        },
      })
    : [];

  // `getSignedUrl` solo compone la ruta del proxy `/api/storage` (no llama a
  // Storage), así que hacerlo por fila en la lista no cuesta red.
  const invoiceFileUrls = await Promise.all(
    pendingInvoices.map((i) => getSignedUrl(invoiceFileBucket(i.ledger), i.filePath)),
  );
  const receiptFileUrls = await Promise.all(
    receipts.map((r) => getSignedUrl(invoiceFileBucket(r.ledger), r.filePath)),
  );

  const invoiceRows: PagosRow[] = pendingInvoices.map((i, index) => {
    const linkedCents = i.links.reduce((sum, l) => sum + l.amountCents, 0);
    return {
      id: i.id,
      kind: "invoice",
      ledger: i.ledger,
      beneficiary: i.supplier.name,
      concept: i.description || i.invoiceNumber,
      iban: canViewBanking ? i.supplier.iban : null,
      fileName: i.fileName,
      fileUrl: invoiceFileUrls[index],
      totalCents: i.totalCents,
      dueDate: i.dueDate,
      reconciliation: reconciliationState(linkedCents, i.totalCents),
      canManage: canManageLedger(user, i.ledger),
      href: `/economia/recibidas/${i.id}`,
    };
  });

  const receiptRows: PagosRow[] = receipts
    .map((r, index) => {
      const linkedCents = r.links.reduce((sum, l) => sum + l.amountCents, 0);
      return {
        id: r.id,
        kind: "receipt" as const,
        ledger: r.ledger,
        beneficiary: r.paidByPerson
          ? `${r.paidByPerson.firstName} ${r.paidByPerson.lastName}`.trim()
          : "",
        concept: r.description,
        iban: canViewBanking ? (r.paidByPerson?.iban ?? null) : null,
        fileName: r.fileName,
        fileUrl: receiptFileUrls[index],
        totalCents: r.totalCents,
        dueDate: null,
        reconciliation: reconciliationState(linkedCents, r.totalCents),
        canManage: canManageLedger(user, r.ledger),
        href: `/economia/tickets/${r.id}`,
        markedPaidAt: r.markedPaidAt,
      };
    })
    .filter((r) => r.reconciliation !== "settled" && !r.markedPaidAt);

  const rows = [...invoiceRows, ...receiptRows].sort((a, b) =>
    (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
  );

  const showLedgerColumn = filter === "both";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title={t("pendingPaymentsTitle")}
        description={t("pendingPaymentsSubtitle")}
        actions={
          <SeasonSelect
            seasons={allSeasons}
            selectedId={season?.id ?? ""}
            extraParams={visible.length > 1 ? { [LEDGER_PARAM]: filter } : undefined}
          />
        }
      />
      <EconomiaSectionNav current="pagos" ledger={filter} visible={visible} />

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={CheckCircleIcon}
          title={t("noPendingPaymentsTitle")}
          description={t("noPendingPaymentsDescription")}
        />
      ) : (
        <PagosTable
          rows={rows}
          locale={locale}
          showLedgerColumn={showLedgerColumn}
          markActions={{
            receipt: { mark: markPurchaseReceiptPaid, unmark: unmarkPurchaseReceiptPaid },
            invoice: { mark: markReceivedInvoicePaid, unmark: unmarkReceivedInvoicePaid },
          }}
          bulkMarkAction={markPendingPaidBulk}
        />
      )}
    </div>
  );
}
