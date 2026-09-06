"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  DeleteReceivedInvoiceDialog,
  ReceivedInvoiceDialog,
  type NamedOption,
  type ReceivedInvoiceRow,
} from "@/components/economia/received-invoice-dialog";
import { EmptyValue } from "@/components/empty-value";
import { ExportMenu } from "@/components/export-menu";
import { FiltersBar } from "@/components/filters-bar";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { PaginationBar } from "@/components/pagination-bar";
import { SearchInput } from "@/components/search-input";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFilterParams, useSearchText } from "@/hooks/use-filter-params";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { LEDGER_PARAM, RECEIVED_INVOICE_STATUS_TONE, type Ledger, type LedgerFilter } from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const FILTER_DEFAULTS = { q: "", proveedor: "all", estado: "all" };

export type ReceivedInvoiceListRow = ReceivedInvoiceRow & {
  supplierName: string;
};

export function ReceivedInvoicesBrowser({
  invoices,
  suppliers,
  seasons,
  teams,
  categories,
  filter,
  seasonId,
  manageableLedgers,
  locale,
}: {
  invoices: ReceivedInvoiceListRow[];
  suppliers: NamedOption[];
  seasons: NamedOption[];
  teams: NamedOption[];
  categories: NamedOption[];
  /** "both" mezcla filas de los dos libros en la tabla, con badge de libro. */
  filter: LedgerFilter;
  seasonId: string;
  manageableLedgers: readonly Ledger[];
  locale: string;
}) {
  const t = useTranslations("Economia");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const { proveedor: supplier, estado: status } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) => setFilters({ q: value }));

  const filtered = useMemo(() => {
    let result = invoices;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(needle) ||
          i.supplierName.toLowerCase().includes(needle) ||
          (i.description?.toLowerCase().includes(needle) ?? false),
      );
    }
    if (supplier !== "all") result = result.filter((i) => i.supplierId === supplier);
    if (status !== "all") result = result.filter((i) => i.status === status);
    return result;
  }, [invoices, query, supplier, status]);

  // Totales agrupados por libro — nunca sumados entre libros, misma regla que
  // en `movements-browser.tsx`.
  const totalsByLedger = useMemo(() => {
    const map = new Map<Ledger, { pending: number; paid: number }>();
    for (const i of filtered) {
      const side = map.get(i.ledger) ?? { pending: 0, paid: 0 };
      if (i.status === "paid") side.paid += i.totalCents;
      else if (i.status === "pending") side.pending += i.totalCents;
      map.set(i.ledger, side);
    }
    return map;
  }, [filtered]);

  const showLedgerColumn = filter === "both";
  const canManageAny = manageableLedgers.length > 0;

  const { page, pageCount, setPage, pageRows } = usePagedRows(filtered);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const formatDate = (value: string) => dateFmt.format(new Date(`${value}T00:00:00`));

  // Los filtros viven en estado local, así que viajan al libro imprimible por
  // la URL: es lo que le permite reproducir en servidor la misma selección
  // que hay en pantalla (mismo patrón que `medical-panel-browser.tsx`).
  const printParams = new URLSearchParams();
  printParams.set(LEDGER_PARAM, filter);
  printParams.set("season", seasonId);
  if (supplier !== "all") printParams.set("proveedor", supplier);
  if (status !== "all") printParams.set("estado", status);
  if (query.trim()) printParams.set("q", query.trim());
  const printListHref = `/economia/recibidas/libro?${printParams}`;

  function exportData() {
    const headers = [
      t("invoiceNumberLabel"),
      t("invoiceSupplierLabel"),
      t("invoiceIssuedOnLabel"),
      t("invoiceDueDateLabel"),
      t("invoiceTotalLabel"),
      t("invoiceStatusLabel"),
    ];
    const rows = filtered.map((i) => [
      i.invoiceNumber,
      i.supplierName,
      i.issuedOn,
      i.dueDate ?? "",
      String(i.totalCents / 100),
      t(`invoiceStatus_${i.status}`),
    ]);
    return { headers, rows };
  }

  return (
    <>
      <div className={cn("grid gap-4", showLedgerColumn && "md:grid-cols-2")}>
        {[...totalsByLedger.entries()].map(([ledger, totals]) => (
          <div key={ledger} className="flex flex-col gap-2">
            {showLedgerColumn ? (
              <StatusBadge tone="neutral" label={t(`ledger_${ledger}`)} />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label={t("totalPendingLabel")} value={formatCents(totals.pending, locale)} />
              <StatTile label={t("totalPaidLabel")} value={formatCents(totals.paid, locale)} />
            </div>
          </div>
        ))}
      </div>

      <FiltersBar
        trailing={
          <ExportMenu filename="facturas-recibidas" getData={exportData} printHref={printListHref} />
        }
      >
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("invoicesSearchPlaceholder")}
          clearLabel={t("searchClear")}
        />
        <Select value={supplier} onValueChange={(v) => setFilters({ proveedor: v ?? "all" })}>
          <SelectTrigger aria-label={t("invoiceSupplierLabel")}>
            <SelectValue>
              {(value: string) =>
                suppliers.find((s) => s.id === value)?.name ?? t("filterSupplierAll")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterSupplierAll")}</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setFilters({ estado: v ?? "all" })}>
          <SelectTrigger aria-label={t("invoiceStatusLabel")}>
            <SelectValue>
              {(value: string) =>
                value === "all" ? t("filterStatusAll") : t(`invoiceStatus_${value}`)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
            <SelectItem value="pending">{t("invoiceStatus_pending")}</SelectItem>
            <SelectItem value="paid">{t("invoiceStatus_paid")}</SelectItem>
            <SelectItem value="disputed">{t("invoiceStatus_disputed")}</SelectItem>
          </SelectContent>
        </Select>
      </FiltersBar>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noInvoiceResultsTitle")}
          description={t("noInvoiceResultsDescription")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNumberLabel")}</TableHead>
                <TableHead>{t("invoiceSupplierLabel")}</TableHead>
                <TableHead priority="secondary">{t("invoiceIssuedOnLabel")}</TableHead>
                <TableHead priority="tertiary">{t("invoiceDueDateLabel")}</TableHead>
                <TableHead className="text-right">{t("invoiceTotalLabel")}</TableHead>
                <TableHead priority="secondary">{t("invoiceStatusLabel")}</TableHead>
                {showLedgerColumn ? <TableHead priority="tertiary" /> : null}
                {canManageAny ? <TableHead className="w-20" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    <HoverPrefetchLink
                      href={`/economia/recibidas/${i.id}`}
                      className="hover:underline"
                    >
                      {i.invoiceNumber}
                    </HoverPrefetchLink>
                  </TableCell>
                  <TableCell>{i.supplierName}</TableCell>
                  <TableCell priority="secondary" nowrap>
                    {formatDate(i.issuedOn)}
                  </TableCell>
                  <TableCell priority="tertiary" nowrap>
                    {i.dueDate ? formatDate(i.dueDate) : <EmptyValue />}
                  </TableCell>
                  <TableCell nowrap className="text-right font-medium">
                    {formatCents(i.totalCents, locale)}
                  </TableCell>
                  <TableCell priority="secondary">
                    <StatusBadge
                      tone={RECEIVED_INVOICE_STATUS_TONE[i.status]}
                      label={t(`invoiceStatus_${i.status}`)}
                    />
                  </TableCell>
                  {showLedgerColumn ? (
                    <TableCell priority="tertiary">
                      <StatusBadge tone="neutral" label={t(`ledger_${i.ledger}`)} />
                    </TableCell>
                  ) : null}
                  {canManageAny ? (
                    <TableCell>
                      {manageableLedgers.includes(i.ledger) ? (
                        <span className="flex justify-end gap-1">
                          <ReceivedInvoiceDialog
                            mode="edit"
                            invoice={i}
                            fileName={null}
                            fileUrl={null}
                            ledger={i.ledger}
                            manageableLedgers={manageableLedgers}
                            suppliers={suppliers}
                            seasons={seasons}
                            teams={teams}
                            categories={categories}
                          />
                          <DeleteReceivedInvoiceDialog id={i.id} number={i.invoiceNumber} />
                        </span>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
