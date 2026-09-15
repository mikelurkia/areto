import { CheckCircleIcon } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { purchaseReceipts, receivedInvoices, seasons } from "@/db/schema";
import { EconomiaLedgerFilter } from "@/components/economia/economia-ledger-filter";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { EmptyValue } from "@/components/empty-value";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { MaskedIbanText } from "@/components/masked-iban";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeasonSelect } from "@/components/equipos/season-select";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  RECONCILIATION_TONE,
  ledgersForFilter,
  reconciliationState,
  resolveLedgerFilter,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";

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
        with: { supplier: { columns: { name: true, iban: true } } },
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

  type Row = {
    id: string;
    kind: "invoice" | "receipt";
    ledger: (typeof ledgers)[number];
    beneficiary: string;
    iban: string | null;
    totalCents: number;
    dueDate: string | null;
    reconciliation: ReturnType<typeof reconciliationState>;
    href: string;
  };

  const invoiceRows: Row[] = pendingInvoices.map((i) => ({
    id: i.id,
    kind: "invoice",
    ledger: i.ledger,
    beneficiary: i.supplier.name,
    iban: canViewBanking ? i.supplier.iban : null,
    totalCents: i.totalCents,
    dueDate: i.dueDate,
    reconciliation: "pending",
    href: `/economia/recibidas/${i.id}`,
  }));

  const receiptRows: Row[] = receipts
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
        href: `/economia/tickets/${r.id}`,
      };
    })
    .filter((r) => r.reconciliation !== "settled");

  const rows = [...invoiceRows, ...receiptRows].sort((a, b) =>
    (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
  );

  const showLedgerColumn = filter === "both";

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const formatDate = (value: string) => dateFmt.format(new Date(`${value}T00:00:00`));

  return (
    <div className="flex flex-1 flex-col gap-6">
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
      <EconomiaSectionNav
        current="pagos"
        ledger={filter}
        visible={visible}
        ledgerFilterSlot={
          <EconomiaLedgerFilter href="/economia/pagos" filter={filter} visible={visible} />
        }
      />

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={CheckCircleIcon}
          title={t("noPendingPaymentsTitle")}
          description={t("noPendingPaymentsDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pendingPaymentBeneficiaryLabel")}</TableHead>
              <TableHead priority="secondary">{t("accountIbanLabel")}</TableHead>
              <TableHead className="text-right">{t("invoiceTotalLabel")}</TableHead>
              <TableHead priority="secondary">{t("invoiceDueDateLabel")}</TableHead>
              <TableHead priority="secondary">{t("reconciliationLabel")}</TableHead>
              {showLedgerColumn ? <TableHead priority="tertiary" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.kind}-${r.id}`}>
                <TableCell className="font-medium">
                  <HoverPrefetchLink href={r.href} className="hover:underline">
                    {r.beneficiary || <EmptyValue />}
                  </HoverPrefetchLink>
                </TableCell>
                <TableCell priority="secondary">
                  {r.iban ? <MaskedIbanText value={r.iban} /> : <EmptyValue />}
                </TableCell>
                <TableCell nowrap className="text-right font-medium">
                  {formatCents(r.totalCents, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap>
                  {r.dueDate ? formatDate(r.dueDate) : <EmptyValue />}
                </TableCell>
                <TableCell priority="secondary">
                  <StatusBadge
                    tone={RECONCILIATION_TONE[r.reconciliation]}
                    label={t(`reconciliation_${r.reconciliation}`)}
                  />
                </TableCell>
                {showLedgerColumn ? (
                  <TableCell priority="tertiary">
                    <StatusBadge tone="neutral" label={t(`ledger_${r.ledger}`)} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
