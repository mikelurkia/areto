"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  IssuedInvoiceDialog,
  type IssuedInvoiceRow,
  type NamedOption,
} from "@/components/economia/issued-invoice-dialog";
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
import { ISSUED_INVOICE_STATUS_TONE, LEDGER_PARAM, type Ledger } from "@/lib/economia";
import { formatCents } from "@/lib/money";

const FILTER_DEFAULTS = { q: "", estado: "all" };

export function IssuedInvoicesBrowser({
  invoices,
  seasons,
  categories,
  ledger,
  seasonId,
  manageableLedgers,
  locale,
  canManage,
}: {
  invoices: IssuedInvoiceRow[];
  seasons: NamedOption[];
  categories: NamedOption[];
  ledger: Ledger;
  seasonId: string;
  manageableLedgers: readonly Ledger[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Economia");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const { estado: status } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) => setFilters({ q: value }));

  const filtered = useMemo(() => {
    let result = invoices;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.number.toLowerCase().includes(needle) ||
          i.customerName.toLowerCase().includes(needle) ||
          (i.concept?.toLowerCase().includes(needle) ?? false),
      );
    }
    if (status !== "all") result = result.filter((i) => i.status === status);
    return result;
  }, [invoices, query, status]);

  // Una anulada no suma, y una rectificativa resta sola: lleva importes en
  // negativo, así que el total emitido cuadra sin casos especiales.
  const totals = useMemo(() => {
    let issued = 0;
    for (const i of filtered) if (i.status !== "cancelled") issued += i.totalCents;
    return { issued, count: filtered.length };
  }, [filtered]);

  const { page, pageCount, setPage, pageRows } = usePagedRows(filtered);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const formatDate = (value: string) => dateFmt.format(new Date(`${value}T00:00:00`));

  // Los filtros viven en estado local y viajan al libro imprimible por la URL,
  // que es lo que le permite reproducir en servidor la misma selección.
  const printParams = new URLSearchParams();
  printParams.set(LEDGER_PARAM, ledger);
  printParams.set("season", seasonId);
  if (status !== "all") printParams.set("estado", status);
  if (query.trim()) printParams.set("q", query.trim());
  const printListHref = `/economia/emitidas/libro?${printParams}`;

  function exportData() {
    const headers = [
      t("invoiceNumberLabel"),
      t("customerNameLabel"),
      t("invoiceIssuedOnLabel"),
      t("invoiceDueDateLabel"),
      t("invoiceTotalLabel"),
      t("invoiceStatusLabel"),
    ];
    const rows = filtered.map((i) => [
      i.number,
      i.customerName,
      i.issuedOn,
      i.dueDate ?? "",
      String(i.totalCents / 100),
      t(`issuedInvoiceStatus_${i.status}`),
    ]);
    return { headers, rows };
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label={t("totalIssuedLabel")} value={formatCents(totals.issued, locale)} />
        <StatTile label={t("invoiceCountLabel")} value={String(totals.count)} />
      </div>

      <FiltersBar
        trailing={
          <ExportMenu filename="facturas-emitidas" getData={exportData} printHref={printListHref} />
        }
      >
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("issuedInvoicesSearchPlaceholder")}
          clearLabel={t("searchClear")}
        />
        <Select value={status} onValueChange={(v) => setFilters({ estado: v ?? "all" })}>
          <SelectTrigger aria-label={t("invoiceStatusLabel")}>
            <SelectValue>
              {(value: string) =>
                value === "all" ? t("filterStatusAll") : t(`issuedInvoiceStatus_${value}`)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
            <SelectItem value="issued">{t("issuedInvoiceStatus_issued")}</SelectItem>
            <SelectItem value="rectified">{t("issuedInvoiceStatus_rectified")}</SelectItem>
            <SelectItem value="cancelled">{t("issuedInvoiceStatus_cancelled")}</SelectItem>
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
                <TableHead>{t("customerNameLabel")}</TableHead>
                <TableHead priority="secondary">{t("invoiceIssuedOnLabel")}</TableHead>
                <TableHead priority="tertiary">{t("invoiceDueDateLabel")}</TableHead>
                <TableHead className="text-right">{t("invoiceTotalLabel")}</TableHead>
                <TableHead priority="secondary">{t("invoiceStatusLabel")}</TableHead>
                {canManage ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    <HoverPrefetchLink
                      href={`/economia/emitidas/${i.id}`}
                      className="hover:underline"
                    >
                      {i.number}
                    </HoverPrefetchLink>
                  </TableCell>
                  <TableCell>{i.customerName}</TableCell>
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
                      tone={ISSUED_INVOICE_STATUS_TONE[i.status]}
                      label={t(`issuedInvoiceStatus_${i.status}`)}
                    />
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <span className="flex justify-end">
                        <IssuedInvoiceDialog
                          mode="edit"
                          invoice={i}
                          fileName={null}
                          fileUrl={null}
                          ledger={ledger}
                          manageableLedgers={manageableLedgers}
                          seasons={seasons}
                          categories={categories}
                        />
                      </span>
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
