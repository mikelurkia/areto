import { CheckCircleIcon } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { purchaseReceipts, receivedInvoices, seasons } from "@/db/schema";
import {
  markPurchaseReceiptPaid,
  markPurchaseReceiptsPaidBulk,
  unmarkPurchaseReceiptPaid,
} from "@/app/[locale]/(app)/economia/tickets/actions";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { PagosTable, type PagosRow } from "@/components/economia/pagos-table";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { SeasonSelect } from "@/components/equipos/season-select";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  canManageLedger,
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  ledgersForFilter,
  reconciliationState,
  resolveLedgerFilter,
  visibleLedgers,
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

  const invoiceRows: PagosRow[] = pendingInvoices.map((i) => {
    const linkedCents = i.links.reduce((sum, l) => sum + l.amountCents, 0);
    return {
      id: i.id,
      kind: "invoice",
      ledger: i.ledger,
      beneficiary: i.supplier.name,
      iban: canViewBanking ? i.supplier.iban : null,
      totalCents: i.totalCents,
      dueDate: i.dueDate,
      reconciliation: reconciliationState(linkedCents, i.totalCents),
      canManage: false,
      href: `/economia/recibidas/${i.id}`,
    };
  });

  const receiptRows: PagosRow[] = receipts
    .filter((r) => {
      const linkedCents = r.links.reduce((sum, l) => sum + l.amountCents, 0);
      return reconciliationState(linkedCents, r.totalCents) !== "settled" && !r.markedPaidAt;
    })
    .map((r) => {
      const linkedCents = r.links.reduce((sum, l) => sum + l.amountCents, 0);
      return {
        id: r.id,
        kind: "receipt" as const,
        ledger: r.ledger,
        beneficiary: r.paidByPerson
          ? `${r.paidByPerson.firstName} ${r.paidByPerson.lastName}`.trim()
          : "",
        iban: canViewBanking ? (r.paidByPerson?.iban ?? null) : null,
        totalCents: r.totalCents,
        dueDate: null,
        reconciliation: reconciliationState(linkedCents, r.totalCents),
        canManage: canManageLedger(user, r.ledger),
        href: `/economia/tickets/${r.id}`,
      };
    });

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
          markAction={markPurchaseReceiptPaid}
          unmarkAction={unmarkPurchaseReceiptPaid}
          bulkMarkAction={markPurchaseReceiptsPaidBulk}
        />
      )}
    </div>
  );
}
