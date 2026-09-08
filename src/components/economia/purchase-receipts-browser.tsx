"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  DeletePurchaseReceiptDialog,
  PurchaseReceiptDialog,
  type NamedOption,
  type PurchaseReceiptRow,
} from "@/components/economia/purchase-receipt-dialog";
import type { PersonOption } from "@/components/economia/purchase-receipt-person-combobox";
import { EmptyValue } from "@/components/empty-value";
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
import type { Ledger, LedgerFilter, ReconciliationState } from "@/lib/economia";
import { RECONCILIATION_TONE } from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const FILTER_DEFAULTS = { q: "", equipo: "all", categoria: "all" };

export type PurchaseReceiptListRow = PurchaseReceiptRow & {
  paidByName: string;
  reconciliation: ReconciliationState;
};

export function PurchaseReceiptsBrowser({
  receipts,
  seasons,
  teams,
  categories,
  personOptions,
  filter,
  manageableLedgers,
  locale,
}: {
  receipts: PurchaseReceiptListRow[];
  seasons: NamedOption[];
  teams: NamedOption[];
  categories: NamedOption[];
  personOptions: PersonOption[];
  /** "both" mezcla filas de los dos libros en la tabla, con badge de libro. */
  filter: LedgerFilter;
  manageableLedgers: readonly Ledger[];
  locale: string;
}) {
  const t = useTranslations("Economia");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const { equipo: team, categoria: category } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) => setFilters({ q: value }));

  const filtered = useMemo(() => {
    let result = receipts;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.description.toLowerCase().includes(needle) ||
          r.paidByName.toLowerCase().includes(needle),
      );
    }
    if (team !== "all") {
      result = result.filter((r) =>
        team === "none" ? r.teamId === null : r.teamId === team,
      );
    }
    if (category !== "all") {
      result = result.filter((r) =>
        category === "none" ? r.categoryId === null : r.categoryId === category,
      );
    }
    return result;
  }, [receipts, query, team, category]);

  // Totales agrupados por libro — nunca sumados entre libros, misma regla que
  // en `movements-browser.tsx`.
  const totalsByLedger = useMemo(() => {
    const map = new Map<Ledger, number>();
    for (const r of filtered) {
      map.set(r.ledger, (map.get(r.ledger) ?? 0) + r.totalCents);
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

  return (
    <>
      <div className={cn("grid gap-4", showLedgerColumn && "md:grid-cols-2")}>
        {[...totalsByLedger.entries()].map(([ledger, total]) => (
          <div key={ledger} className="flex flex-col gap-2">
            {showLedgerColumn ? (
              <StatusBadge tone="neutral" label={t(`ledger_${ledger}`)} />
            ) : null}
            <StatTile label={t("invoiceTotalLabel")} value={formatCents(total, locale)} />
          </div>
        ))}
      </div>

      <FiltersBar>
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("ticketsSearchPlaceholder")}
          clearLabel={t("searchClear")}
        />
        <Select value={team} onValueChange={(v) => setFilters({ equipo: v ?? "all" })}>
          <SelectTrigger aria-label={t("invoiceTeamLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "none") return t("invoiceTeamNone");
                return teams.find((tm) => tm.id === value)?.name ?? t("filterTeamAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterTeamAll")}</SelectItem>
            <SelectItem value="none">{t("invoiceTeamNone")}</SelectItem>
            {teams.map((tm) => (
              <SelectItem key={tm.id} value={tm.id}>
                {tm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setFilters({ categoria: v ?? "all" })}>
          <SelectTrigger aria-label={t("categoryLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "none") return t("filterCategoryNone");
                return categories.find((c) => c.id === value)?.name ?? t("filterCategoryAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterCategoryAll")}</SelectItem>
            <SelectItem value="none">{t("filterCategoryNone")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FiltersBar>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noTicketsTitle")}
          description={t("noTicketsDescription")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ticketDescriptionLabel")}</TableHead>
                <TableHead>{t("ticketPaidByLabel")}</TableHead>
                <TableHead priority="secondary">{t("ticketPurchasedOnLabel")}</TableHead>
                <TableHead className="text-right">{t("invoiceTotalLabel")}</TableHead>
                <TableHead priority="secondary">{t("reconciliationLabel")}</TableHead>
                {showLedgerColumn ? <TableHead priority="tertiary" /> : null}
                {canManageAny ? <TableHead className="w-20" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <HoverPrefetchLink
                      href={`/economia/tickets/${r.id}`}
                      className="hover:underline"
                    >
                      {r.description}
                    </HoverPrefetchLink>
                  </TableCell>
                  <TableCell>{r.paidByName || <EmptyValue />}</TableCell>
                  <TableCell priority="secondary" nowrap>
                    {formatDate(r.purchasedOn)}
                  </TableCell>
                  <TableCell nowrap className="text-right font-medium">
                    {formatCents(r.totalCents, locale)}
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
                  {canManageAny ? (
                    <TableCell>
                      {manageableLedgers.includes(r.ledger) ? (
                        <span className="flex justify-end gap-1">
                          <PurchaseReceiptDialog
                            mode="edit"
                            receipt={r}
                            fileName={null}
                            fileUrl={null}
                            ledger={r.ledger}
                            manageableLedgers={manageableLedgers}
                            seasons={seasons}
                            teams={teams}
                            categories={categories}
                            personOptions={personOptions}
                          />
                          <DeletePurchaseReceiptDialog id={r.id} description={r.description} />
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
