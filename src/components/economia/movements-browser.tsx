"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { ExportMenu } from "@/components/export-menu";
import { FiltersBar } from "@/components/filters-bar";
import { LinkInvoiceDialog } from "@/components/economia/link-invoice-dialog";
import {
  DeleteMovementDialog,
  MovementDialog,
  type MovementRow,
  type NamedOption,
} from "@/components/economia/movement-dialog";
import { EmptyValue } from "@/components/empty-value";
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
import { RECONCILIATION_TONE, reconciliationState, type Ledger, type LedgerFilter } from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = { q: "", cuenta: "all", categoria: "all", signo: "all" };

type AccountOption = NamedOption & { ledger: Ledger };

type InvoiceOption = { id: string; ledger: Ledger; number: string; totalCents: number; label: string };
type LinkAction = (prev: EconomiaState, formData: FormData) => Promise<EconomiaState>;

export function MovementsBrowser({
  movements,
  accounts,
  seasons,
  categories,
  seasonId,
  locale,
  filter,
  manageableLedgers,
  receivedInvoices,
  issuedInvoices,
  purchaseReceipts,
  linkReceivedInvoiceAction,
  linkIssuedInvoiceAction,
  linkPurchaseReceiptAction,
}: {
  movements: MovementRow[];
  /**
   * Cuentas del libro: las retiradas incluidas, porque sus apuntes siguen en
   * el listado y hay que poder filtrarlos y editarlos.
   */
  accounts: AccountOption[];
  seasons: NamedOption[];
  categories: NamedOption[];
  seasonId: string;
  locale: string;
  /** "both" mezcla filas de los dos libros en la tabla, con badge de libro. */
  filter: LedgerFilter;
  manageableLedgers: readonly Ledger[];
  /** Candidatas para "vincular factura desde el movimiento", por libro. */
  receivedInvoices: InvoiceOption[];
  issuedInvoices: InvoiceOption[];
  purchaseReceipts: InvoiceOption[];
  linkReceivedInvoiceAction: LinkAction;
  linkIssuedInvoiceAction: LinkAction;
  linkPurchaseReceiptAction: LinkAction;
}) {
  const t = useTranslations("Economia");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const { cuenta: account, categoria: category, signo: sign } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) => setFilters({ q: value }));

  const filtered = useMemo(() => {
    let result = movements;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter(
        (m) =>
          m.concept.toLowerCase().includes(needle) ||
          (m.counterparty?.toLowerCase().includes(needle) ?? false),
      );
    }
    if (account !== "all") result = result.filter((m) => m.accountId === account);
    if (category !== "all") {
      result = result.filter((m) =>
        category === "none" ? m.categoryId === null : m.categoryId === category,
      );
    }
    if (sign !== "all") {
      result = result.filter((m) =>
        sign === "income" ? m.amountCents > 0 : m.amountCents < 0,
      );
    }
    return result;
  }, [movements, query, account, category, sign]);

  // Los totales son los de lo filtrado, no los de la temporada entera: si no,
  // filtrar por cuenta dejaría unas cifras que no cuadran con la tabla. En
  // "ambos" se agrupan por libro primero — nunca se suman entre libros.
  const totalsByLedger = useMemo(() => {
    const map = new Map<Ledger, { income: number; expense: number; net: number }>();
    for (const m of filtered) {
      const side = map.get(m.ledger) ?? { income: 0, expense: 0, net: 0 };
      if (m.amountCents > 0) side.income += m.amountCents;
      else side.expense += m.amountCents;
      side.net = side.income + side.expense;
      map.set(m.ledger, side);
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

  function exportData() {
    const headers = [
      t("bookedOnLabel"),
      t("valueOnLabel"),
      t("movementAccountLabel"),
      t("conceptLabel"),
      t("counterpartyLabel"),
      t("categoryLabel"),
      t("amountLabel"),
      t("balanceLabel"),
    ];
    const rows = filtered.map((m) => [
      m.bookedOn,
      m.valueOn ?? "",
      m.accountName,
      m.concept,
      m.counterparty ?? "",
      m.categoryName ?? "",
      String(m.amountCents / 100),
      m.balanceCents === null ? "" : String(m.balanceCents / 100),
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
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label={t("totalIncomeLabel")} value={formatCents(totals.income, locale)} />
              <StatTile label={t("totalExpenseLabel")} value={formatCents(totals.expense, locale)} />
              <StatTile label={t("netLabel")} value={formatCents(totals.net, locale)} />
            </div>
          </div>
        ))}
      </div>

      <FiltersBar
        trailing={<ExportMenu filename="movimientos" getData={exportData} />}
      >
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("movementsSearchPlaceholder")}
          clearLabel={t("searchClear")}
        />
        <Select value={account} onValueChange={(v) => setFilters({ cuenta: v ?? "all" })}>
          <SelectTrigger aria-label={t("movementAccountLabel")}>
            <SelectValue>
              {(value: string) =>
                accounts.find((a) => a.id === value)?.name ?? t("filterAccountAll")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAccountAll")}</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setFilters({ categoria: v ?? "all" })}>
          <SelectTrigger aria-label={t("categoryLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "none") return t("filterCategoryNone");
                return (
                  categories.find((c) => c.id === value)?.name ?? t("filterCategoryAll")
                );
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
        <Select value={sign} onValueChange={(v) => setFilters({ signo: v ?? "all" })}>
          <SelectTrigger aria-label={t("filterSignLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "income") return t("filterSignIncome");
                if (value === "expense") return t("filterSignExpense");
                return t("filterSignAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterSignAll")}</SelectItem>
            <SelectItem value="income">{t("filterSignIncome")}</SelectItem>
            <SelectItem value="expense">{t("filterSignExpense")}</SelectItem>
          </SelectContent>
        </Select>
      </FiltersBar>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noMovementResultsTitle")}
          description={t("noMovementResultsDescription")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("bookedOnLabel")}</TableHead>
                <TableHead>{t("conceptLabel")}</TableHead>
                <TableHead priority="secondary">{t("movementAccountLabel")}</TableHead>
                <TableHead priority="tertiary">{t("counterpartyLabel")}</TableHead>
                <TableHead priority="secondary">{t("categoryLabel")}</TableHead>
                <TableHead priority="tertiary">{t("invoiceLinkLabel")}</TableHead>
                <TableHead className="text-right">{t("amountLabel")}</TableHead>
                <TableHead priority="tertiary" className="text-right">
                  {t("balanceLabel")}
                </TableHead>
                {showLedgerColumn ? <TableHead priority="tertiary" /> : null}
                {canManageAny ? <TableHead className="w-28" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell nowrap>{formatDate(m.bookedOn)}</TableCell>
                  <TableCell className="font-medium">{m.concept}</TableCell>
                  <TableCell priority="secondary">{m.accountName}</TableCell>
                  <TableCell priority="tertiary">
                    {m.counterparty ?? <EmptyValue />}
                  </TableCell>
                  <TableCell priority="secondary">
                    {m.categoryName ?? <EmptyValue />}
                  </TableCell>
                  <TableCell priority="tertiary" nowrap>
                    {m.invoiceLinks.length > 0 ? (
                      <span className="flex items-center gap-2">
                        <StatusBadge
                          tone={RECONCILIATION_TONE[reconciliationState(m.linkedCents, m.amountCents)]}
                          label={t(
                            `reconciliation_${reconciliationState(m.linkedCents, m.amountCents)}`,
                          )}
                        />
                        <span className="max-w-32 truncate">
                          {m.invoiceLinks.map((link, index) => (
                            <span key={link.id}>
                              {index > 0 ? ", " : null}
                              <HoverPrefetchLink
                                href={`/economia/${
                                  link.kind === "received"
                                    ? "recibidas"
                                    : link.kind === "issued"
                                      ? "emitidas"
                                      : "tickets"
                                }/${link.id}`}
                                className="hover:underline"
                              >
                                {link.number}
                              </HoverPrefetchLink>
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : (
                      <EmptyValue />
                    )}
                  </TableCell>
                  <TableCell
                    nowrap
                    className={
                      m.amountCents < 0
                        ? "text-right font-medium"
                        : "text-right font-medium text-success"
                    }
                  >
                    {formatCents(m.amountCents, locale)}
                  </TableCell>
                  <TableCell priority="tertiary" nowrap className="text-right">
                    {m.balanceCents === null ? (
                      <EmptyValue />
                    ) : (
                      formatCents(m.balanceCents, locale)
                    )}
                  </TableCell>
                  {showLedgerColumn ? (
                    <TableCell priority="tertiary">
                      <StatusBadge tone="neutral" label={t(`ledger_${m.ledger}`)} />
                    </TableCell>
                  ) : null}
                  {canManageAny ? (
                    <TableCell>
                      {manageableLedgers.includes(m.ledger) ? (
                        <span className="flex justify-end gap-1">
                          <LinkInvoiceDialog
                            movementId={m.id}
                            amountCents={m.amountCents}
                            receivedInvoices={receivedInvoices.filter((i) => i.ledger === m.ledger)}
                            issuedInvoices={issuedInvoices.filter((i) => i.ledger === m.ledger)}
                            purchaseReceipts={purchaseReceipts.filter((i) => i.ledger === m.ledger)}
                            linkReceivedInvoiceAction={linkReceivedInvoiceAction}
                            linkIssuedInvoiceAction={linkIssuedInvoiceAction}
                            linkPurchaseReceiptAction={linkPurchaseReceiptAction}
                            locale={locale}
                          />
                          <MovementDialog
                            mode="edit"
                            movement={m}
                            accounts={accounts.filter((a) => a.ledger === m.ledger)}
                            seasons={seasons}
                            categories={categories}
                            seasonId={seasonId}
                          />
                          <DeleteMovementDialog id={m.id} concept={m.concept} />
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
