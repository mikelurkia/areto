"use client";

import { useMemo } from "react";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import {
  DeleteSeasonDialog,
  SeasonDialog,
} from "@/components/temporada/season-dialog";
import { PaginationBar } from "@/components/pagination-bar";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { downloadCsv } from "@/lib/csv";

type SeasonRow = {
  id: string;
  name: string;
  isCurrent: boolean;
  startsOn: string | null;
  endsOn: string | null;
  teamsCount: number;
};

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = { q: "" };

export function TemporadasBrowser({
  seasons,
  locale,
  canManage,
}: {
  seasons: SeasonRow[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Temporadas");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const fmtDate = (d: string | null) =>
    d ? dateFmt.format(new Date(`${d}T00:00:00`)) : null;

  const filtered = useMemo(() => {
    if (!query.trim()) return seasons;
    const needle = query.trim().toLowerCase();
    return seasons.filter((season) => season.name.toLowerCase().includes(needle));
  }, [seasons, query]);

  const { page, pageCount, setPage, pageRows } = usePagedRows(filtered);

  function handleExportCsv() {
    const headers = [t("colName"), t("colDates"), t("colTeams")];
    const rows = filtered.map((season) => {
      const starts = fmtDate(season.startsOn);
      const ends = fmtDate(season.endsOn);
      return [
        season.name,
        starts || ends ? `${starts ?? "—"} – ${ends ?? "—"}` : "",
        String(season.teamsCount),
      ];
    });
    downloadCsv("temporadas.csv", headers, rows);
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
        <Button variant="outline" className="ml-auto" onClick={handleExportCsv}>
          <DownloadIcon data-icon="inline-start" />
          {t("exportCsvAction")}
        </Button>
      </div>

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
              <TableHead>{t("colName")}</TableHead>
              <TableHead priority="secondary">{t("colDates")}</TableHead>
              <TableHead>{t("colTeams")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">{t("colActions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((season) => {
              const starts = fmtDate(season.startsOn);
              const ends = fmtDate(season.endsOn);
              return (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">
                    <HoverPrefetchLink href={`/temporadas/${season.id}`} className="hover:underline">
                      {season.name}
                    </HoverPrefetchLink>
                    {season.isCurrent ? (
                      <Badge variant="secondary" className="ml-2">
                        {t("currentBadge")}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell priority="secondary">
                    {starts || ends ? `${starts ?? "—"} – ${ends ?? "—"}` : "—"}
                  </TableCell>
                  <TableCell>{season.teamsCount}</TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <SeasonDialog mode="edit" season={season} />
                        <DeleteSeasonDialog id={season.id} name={season.name} />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* La barra no pinta nada mientras quepa todo en una página. */}
      <PaginationBar page={page} pageCount={pageCount} onPageChange={setPage} />
    </>
  );
}
