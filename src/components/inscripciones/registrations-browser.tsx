"use client";

import { StatusBadge } from "@/components/status-badge";
import { useMemo } from "react";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFilterParams, useSearchText } from "@/hooks/use-filter-params";
import { downloadCsv } from "@/lib/csv";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { STATUS_TONE, type RegistrationStatus } from "@/lib/registration-status";
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
import { SectionPlaceholder } from "@/components/section-placeholder";
import { DeleteRegistrationDialog } from "@/components/inscripciones/delete-registration-dialog";

type RegistrationRow = {
  id: string;
  status: RegistrationStatus;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  email: string | null;
  phone: string | null;
  guardiansCount: number;
  photosCount: number;
  createdAt: string;
};

/**
 * Filtros de la pantalla. Se entra viendo las pendientes, que es a lo que se
 * viene; el resto se pide expresamente y queda escrito en la URL.
 */
const FILTER_DEFAULTS = { q: "", estado: "pending" };

export function RegistrationsBrowser({
  registrations,
  canManage,
}: {
  registrations: RegistrationRow[];
  canManage: boolean;
}) {
  const t = useTranslations("Inscripciones");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const status = filters.estado;
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );

  const filtered = useMemo(() => {
    let result = registrations;
    if (status !== "all") result = result.filter((r) => r.status === status);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((r) =>
        [`${r.firstName} ${r.lastName}`, r.nationalId ?? "", r.email ?? ""].some((h) =>
          h.toLowerCase().includes(needle),
        ),
      );
    }
    return result;
  }, [registrations, query, status]);

  /** Exporta lo que se está viendo, filtro incluido. */
  function handleExportCsv() {
    const headers = [
      t("colName"),
      t("colNationalId"),
      t("colContact"),
      t("colGuardians"),
      t("colPhotos"),
      t("colDate"),
      t("colStatus"),
    ];
    const rows = filtered.map((r) => [
      `${r.firstName} ${r.lastName}`,
      r.nationalId ?? "",
      r.email || r.phone || "",
      String(r.guardiansCount),
      String(r.photosCount),
      r.createdAt,
      t(`status.${r.status}`),
    ]);
    downloadCsv("inscripciones.csv", headers, rows);
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
              {(value: string) =>
                value === "all"
                  ? t("filterStatusAll")
                  : t(`status.${value}` as "status.pending")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
            <SelectItem value="approved">{t("status.approved")}</SelectItem>
            <SelectItem value="rejected">{t("status.rejected")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
        >
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
              <TableHead priority="tertiary">{t("colNationalId")}</TableHead>
              <TableHead priority="tertiary">{t("colContact")}</TableHead>
              <TableHead priority="tertiary">{t("colGuardians")}</TableHead>
              <TableHead priority="secondary">{t("colPhotos")}</TableHead>
              <TableHead priority="secondary">{t("colDate")}</TableHead>
              <TableHead priority="secondary">{t("colStatus")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">{t("colActions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <HoverPrefetchLink href={`/inscripciones/${r.id}`} className="hover:underline">
                    {r.firstName} {r.lastName}
                  </HoverPrefetchLink>
                  {/* El DNI tiene columna propia a partir de `lg`; por debajo
                      baja aquí para no perderse. */}
                  {r.nationalId ? (
                    <span className="block text-xs font-normal text-muted-foreground tabular-nums lg:hidden">
                      {r.nationalId}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell
                  priority="tertiary"
                  nowrap
                  className="text-muted-foreground tabular-nums"
                >
                  {r.nationalId ?? "—"}
                </TableCell>
                <TableCell priority="tertiary" className="text-muted-foreground">
                  {r.email || r.phone || "—"}
                </TableCell>
                <TableCell priority="tertiary" className="text-muted-foreground">
                  {r.guardiansCount > 0 ? r.guardiansCount : "—"}
                </TableCell>
                <TableCell priority="secondary">
                  <Badge variant={r.photosCount === 3 ? "secondary" : r.photosCount === 0 ? "destructive" : "warning"}>
                    {t("photosCount", { count: r.photosCount })}
                  </Badge>
                </TableCell>
                <TableCell priority="secondary" nowrap className="text-muted-foreground">
                  {r.createdAt}
                </TableCell>
                <TableCell priority="secondary">
                  <StatusBadge tone={STATUS_TONE[r.status]} label={t(`status.${r.status}`)} />
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    {r.status === "rejected" ? (
                      <DeleteRegistrationDialog
                        registrationId={r.id}
                        fullName={`${r.firstName} ${r.lastName}`}
                      />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
