"use client";

import { useMemo } from "react";
import { DownloadIcon, HandshakeIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { DeleteSponsorDialog } from "@/components/patrocinadores/delete-sponsor-dialog";
import { SponsorDialog } from "@/components/patrocinadores/sponsor-dialog";
import { PrintButton } from "@/components/print-button";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { downloadCsv } from "@/lib/csv";
import { SPONSORSHIP_EXPIRY_WINDOW_DAYS, sponsorshipStatus } from "@/lib/sponsorship";

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
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
      amountCents / 100,
    );
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

  function handleExportCsv() {
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
    downloadCsv("patrocinadores.csv", headers, rows);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-56 pl-8"
          />
        </div>
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
        <div className="ml-auto flex gap-2">
          <PrintButton label={t("printAction")} />
          <Button variant="outline" onClick={handleExportCsv}>
            <DownloadIcon data-icon="inline-start" />
            {t("exportCsvAction")}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          icon={HandshakeIcon}
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colSponsor")}</TableHead>
              <TableHead>{t("logoLabel")}</TableHead>
              <TableHead>{t("tierLabel")}</TableHead>
              <TableHead>{t("colContact")}</TableHead>
              <TableHead>{t("colAmount")}</TableHead>
              <TableHead>{t("colDates")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
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
                      <Link href={`/patrocinadores/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
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
                  <TableCell>
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
                  <TableCell>
                    {s.currentTerm?.tier ? (
                      <Badge variant={s.currentTerm.tier === "principal" ? "gold" : "outline"}>
                        {t(`tier.${s.currentTerm.tier}`)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
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
                  <TableCell>{formatAmount(s.currentTerm?.totalAmountCents ?? null)}</TableCell>
                  <TableCell>
                    {s.currentTerm
                      ? `${s.currentTerm.startsOn ?? "—"} — ${
                          s.currentTerm.endsOn ?? t("ongoing")
                        }`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {rowStatus === "active" ? (
                      <Badge variant="secondary">{t("activeBadge")}</Badge>
                    ) : rowStatus === "expiringSoon" ? (
                      <Badge variant="warning">{t("expiringSoonBadge")}</Badge>
                    ) : rowStatus === "expired" ? (
                      <Badge variant="destructive">{t("expiredBadge")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("noTermBadge")}</Badge>
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
