"use client";

import { StatusBadge } from "@/components/status-badge";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { DeleteSponsorDialog } from "@/components/patrocinadores/delete-sponsor-dialog";
import { SponsorDialog } from "@/components/patrocinadores/sponsor-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { FiltersBar } from "@/components/filters-bar";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
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
import { ExportMenu } from "@/components/export-menu";
import {
  SPONSORSHIP_EXPIRY_WINDOW_DAYS,
  SPONSORSHIP_TONE,
  sponsorshipStatus,
} from "@/lib/sponsorship";
import { formatCents } from "@/lib/money";

type CurrentTerm = {
  tier: string | null;
  totalAmountCents: number | null;
  startsOn: string | null;
  endsOn: string | null;
  contractUrl: string | null;
};

type SponsorRow = {
  id: string;
  name: string;
  contactPersonId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  fiscalName: string | null;
  taxId: string | null;
  fiscalAddress: string | null;
  notes: string | null;
  contactPerson: { firstName: string; lastName: string } | null;
  logoUrl: string | null;
  termsCount: number;
  currentTerm: CurrentTerm | null;
};

type PersonOption = { id: string; firstName: string; lastName: string };

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = { q: "", estado: "all", nivel: "all" };

export function SponsorsBrowser({
  sponsors,
  personOptions,
  locale,
  canManage,
}: {
  sponsors: SponsorRow[];
  personOptions: PersonOption[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Patrocinadores");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const { estado: status, nivel: tier } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + SPONSORSHIP_EXPIRY_WINDOW_DAYS);
    return d.toISOString().slice(0, 10);
  }, []);

  function formatAmount(amountCents: number | null) {
    if (amountCents === null) return "—";
    return formatCents(amountCents, locale);
  }

  function statusOf(s: SponsorRow): "active" | "expiringSoon" | "expired" | "noTerm" {
    if (!s.currentTerm) return "noTerm";
    return sponsorshipStatus(s.currentTerm.endsOn, today, cutoff);
  }

  const filtered = useMemo(() => {
    let result = sponsors;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(needle));
    }
    if (status !== "all") {
      result = result.filter((s) => statusOf(s) === status);
    }
    if (tier !== "all") {
      result = result.filter((s) =>
        tier === "none" ? !s.currentTerm?.tier : s.currentTerm?.tier === tier,
      );
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsors, query, status, tier, today, cutoff]);

  function exportData() {
    const headers = [
      t("colSponsor"),
      t("tierLabel"),
      t("colContact"),
      t("contactEmailLabel"),
      t("contactPhoneLabel"),
      t("colAmount"),
      t("startsOnLabel"),
      t("endsOnLabel"),
    ];
    const rows = filtered.map((s) => [
      s.name,
      s.currentTerm?.tier ? t(`tier.${s.currentTerm.tier}`) : "",
      s.contactPerson ? `${s.contactPerson.firstName} ${s.contactPerson.lastName}` : "",
      s.contactEmail ?? "",
      s.contactPhone ?? "",
      formatAmount(s.currentTerm?.totalAmountCents ?? null),
      s.currentTerm?.startsOn ?? "",
      s.currentTerm?.endsOn ?? "",
    ]);
    return { headers, rows };
  }

  return (
    <>
      <FiltersBar
        trailing={
          /* Esta pantalla *es* el documento (tiene sus bloques `print:`), así
             que imprimir es imprimirla, no ir a otra ruta. */
          <ExportMenu
            filename="patrocinadores"
            getData={exportData}
            onPrint={() => window.print()}
          />
        }
      >
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("searchClear")}
        />
        <Select value={status} onValueChange={(v) => setFilters({ estado: v ?? "all" })}>
          <SelectTrigger aria-label={t("filterStatusLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "active") return t("filterStatusActive");
                if (value === "expiringSoon") return t("filterStatusExpiringSoon");
                if (value === "expired") return t("filterStatusExpired");
                if (value === "noTerm") return t("filterStatusNoTerm");
                return t("filterStatusAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
            <SelectItem value="active">{t("filterStatusActive")}</SelectItem>
            <SelectItem value="expiringSoon">{t("filterStatusExpiringSoon")}</SelectItem>
            <SelectItem value="expired">{t("filterStatusExpired")}</SelectItem>
            <SelectItem value="noTerm">{t("filterStatusNoTerm")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={(v) => setFilters({ nivel: v ?? "all" })}>
          <SelectTrigger aria-label={t("filterTierLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "principal") return t("tier.principal");
                if (value === "colaborador") return t("tier.colaborador");
                if (value === "publicidad") return t("tier.publicidad");
                if (value === "none") return t("filterTierNone");
                return t("filterTierAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterTierAll")}</SelectItem>
            <SelectItem value="principal">{t("tier.principal")}</SelectItem>
            <SelectItem value="colaborador">{t("tier.colaborador")}</SelectItem>
            <SelectItem value="publicidad">{t("tier.publicidad")}</SelectItem>
            <SelectItem value="none">{t("filterTierNone")}</SelectItem>
          </SelectContent>
        </Select>
      </FiltersBar>

      {/*
        Sin paginar, a propósito: esta pantalla se imprime (`ExportMenu`), y lo
        que no está pintado no sale en el papel. Paginarla dejaría el listado
        impreso incompleto sin avisar.
      */}
      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colSponsor")}</TableHead>
              <TableHead priority="tertiary">{t("logoLabel")}</TableHead>
              <TableHead priority="secondary">{t("tierLabel")}</TableHead>
              <TableHead priority="tertiary">{t("colContact")}</TableHead>
              <TableHead priority="secondary">{t("colAmount")}</TableHead>
              <TableHead priority="tertiary">{t("colDates")}</TableHead>
              <TableHead priority="secondary">{t("colStatus")}</TableHead>
              {canManage ? (
                <TableHead className="text-right print:hidden">
                  {t("colActions")}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const rowStatus = statusOf(s);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-1">
                      <HoverPrefetchLink href={`/patrocinadores/${s.id}`} className="hover:underline">
                        {s.name}
                      </HoverPrefetchLink>
                      {s.currentTerm?.contractUrl ? (
                        <a
                          href={s.currentTerm.contractUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline print:hidden"
                        >
                          {t("viewContract")}
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell priority="tertiary">
                    {s.logoUrl ? (
                      <div className="flex h-10 w-20 items-center justify-center rounded border bg-muted/30 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.logoUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell priority="secondary">
                    {s.currentTerm?.tier ? (
                      <Badge variant={s.currentTerm.tier === "principal" ? "gold" : "outline"}>
                        {t(`tier.${s.currentTerm.tier}`)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell priority="tertiary">
                    <div className="flex flex-col text-sm">
                      {s.contactPerson ? (
                        <span>
                          {s.contactPerson.firstName} {s.contactPerson.lastName}
                        </span>
                      ) : null}
                      {s.contactEmail ? (
                        <span className="text-muted-foreground">{s.contactEmail}</span>
                      ) : null}
                      {s.contactPhone ? (
                        <span className="text-muted-foreground">{s.contactPhone}</span>
                      ) : null}
                      {!s.contactPerson && !s.contactEmail && !s.contactPhone
                        ? "—"
                        : null}
                    </div>
                  </TableCell>
                  <TableCell priority="secondary" nowrap>
                    {formatAmount(s.currentTerm?.totalAmountCents ?? null)}
                  </TableCell>
                  <TableCell priority="tertiary">
                    {s.currentTerm
                      ? `${s.currentTerm.startsOn ?? "—"} — ${
                          s.currentTerm.endsOn ?? t("ongoing")
                        }`
                      : "—"}
                  </TableCell>
                  <TableCell priority="secondary">
                    {rowStatus === "noTerm" ? (
                      <StatusBadge tone="neutral" label={t("noTermBadge")} />
                    ) : (
                      <StatusBadge
                        tone={SPONSORSHIP_TONE[rowStatus]}
                        label={t(`${rowStatus}Badge`)}
                      />
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="flex justify-end gap-1 print:hidden">
                      <SponsorDialog
                        mode="edit"
                        sponsor={s}
                        logoUrl={s.logoUrl}
                        personOptions={personOptions}
                      />
                      <DeleteSponsorDialog id={s.id} name={s.name} />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
