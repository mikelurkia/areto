"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { DownloadIcon, MailIcon, SearchIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  assignNextMemberNumber,
  bulkSetMember,
} from "@/app/[locale]/(app)/personas/actions";
import {
  emailsForMemberSelection,
  exportMemberRows,
} from "@/app/[locale]/(app)/socios/list-actions";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionPlaceholder } from "@/components/section-placeholder";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFilterParams, useSearchText } from "@/hooks/use-filter-params";
import { downloadCsv } from "@/lib/csv";

export type SocioRow = {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: number | null;
  email: string | null;
  phone: string | null;
  joinedAt: string;
};

/** Botón "Asignar nº" de una fila: `useActionState` propio para no compartir
 * el estado de carga con el resto de la tabla. */
function AssignMemberNumberButton({ personId }: { personId: string }) {
  const t = useTranslations("Socios");
  const [state, action] = useActionState(assignNextMemberNumber, {});
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={personId} />
      <Button type="submit" variant="outline" size="sm">
        {t("assignNumberAction")}
      </Button>
    </form>
  );
}

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = { q: "", pagina: "1" };

export function SociosBrowser({
  socios,
  total,
  pageCount,
  page: currentPage,
  canManage,
}: {
  /** Solo las filas de la página actual: el filtrado y el troceado los hace SQL. */
  socios: SocioRow[];
  total: number;
  pageCount: number;
  page: number;
  canManage: boolean;
}) {
  const t = useTranslations("Socios");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS, { navigate: true });
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value, pagina: "1" }),
  );
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  /** Exporta todas las filas que casan con la búsqueda, no solo la página
   * actual: con la paginación en servidor el navegador ya no tiene el resto. */
  function handleExportCsv() {
    startExportTransition(async () => {
      const rows = await exportMemberRows(Object.fromEntries(searchParams));
      const headers = [
        t("colName"),
        t("colMemberNumber"),
        t("colContact"),
        t("colJoinedAt"),
      ];
      downloadCsv(
        "socios.csv",
        headers,
        rows.map((s) => [
          `${s.firstName} ${s.lastName}`,
          s.memberNumber !== null ? String(s.memberNumber) : "",
          s.email || s.phone || "",
          s.joinedAt,
        ]),
      );
    });
  }

  function handleCancel(personId: string) {
    setPendingCancelId(personId);
    startTransition(async () => {
      await bulkSetMember([personId], false);
      toast.success(t("memberCancelled"));
      setPendingCancelId(null);
    });
  }

  const allPageSelected =
    socios.length > 0 && socios.every((s) => selectedIds.has(s.id));

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      socios.forEach((s) => (checked ? next.add(s.id) : next.delete(s.id)));
      return next;
    });
  }

  // Emails de la selección, para el envío masivo con copia oculta (BCC). Se
  // piden al servidor: la selección se conserva al cambiar de página, así que
  // puede incluir socios que ya no están en `socios`.
  const [fetchedEmails, setFetchedEmails] = useState<string[]>([]);
  useEffect(() => {
    if (selectedIds.size === 0) return;
    let cancelled = false;
    emailsForMemberSelection([...selectedIds]).then((emails) => {
      if (!cancelled) setFetchedEmails(emails);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIds]);
  const bulkEmails = selectedIds.size === 0 ? [] : fetchedEmails;
  const bulkEmailHref = `mailto:?bcc=${encodeURIComponent(bulkEmails.join(","))}`;

  function handleBulkCancel() {
    const ids = [...selectedIds];
    startBulkTransition(async () => {
      await bulkSetMember(ids, false);
      toast.success(t("bulkMembersCancelled", { count: ids.length }));
      setSelectedIds(new Set());
    });
  }

  function goToPage(next: number) {
    setFilters({ pagina: String(Math.min(Math.max(1, next), pageCount)) });
  }

  /**
   * URL de una página. El clic lo atiende `goToPage` (que reemplaza en el
   * historial); esto es para que el enlace se pueda abrir en otra pestaña.
   */
  function hrefForPage(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page === 1) params.delete("pagina");
    else params.set("pagina", String(page));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={handleExportCsv}
          disabled={isExporting}
        >
          <DownloadIcon data-icon="inline-start" />
          {t("exportCsvAction")}
        </Button>
      </div>

      {canManage && selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-sm font-medium">
            {t("bulkSelectedCount", { count: selectedIds.size })}
          </span>
          <Button
            variant="outline"
            size="sm"
            render={<a href={bulkEmailHref} />}
            nativeButton={false}
            aria-disabled={bulkEmails.length === 0}
            className={bulkEmails.length === 0 ? "pointer-events-none opacity-50" : undefined}
          >
            <MailIcon data-icon="inline-start" />
            {t("bulkEmailAction", { count: bulkEmails.length })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            disabled={isBulkPending}
            onClick={handleBulkCancel}
          >
            {t("bulkCancelMembershipAction")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            {t("bulkClearSelection")}
          </Button>
        </div>
      ) : null}

      {total === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {canManage ? (
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      aria-label={t("bulkSelectAllSr")}
                    />
                  </TableHead>
                ) : null}
                <TableHead>{t("colName")}</TableHead>
                <TableHead priority="secondary">{t("colMemberNumber")}</TableHead>
                <TableHead priority="tertiary">{t("colContact")}</TableHead>
                <TableHead priority="secondary">{t("colJoinedAt")}</TableHead>
                {canManage ? (
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {socios.map((s) => (
                <TableRow key={s.id}>
                  {canManage ? (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={(checked) => toggleSelected(s.id, checked === true)}
                        aria-label={t("bulkSelectRowSr", { name: `${s.firstName} ${s.lastName}` })}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    <HoverPrefetchLink
                      href={`/personas/${s.id}?from=${encodeURIComponent("/socios")}`}
                      className="hover:underline"
                    >
                      {s.firstName} {s.lastName}
                    </HoverPrefetchLink>
                    {/* El número de socio tiene columna propia a partir de
                        `md`; por debajo baja aquí para no perderse. */}
                    {s.memberNumber ? (
                      <span className="block text-xs font-normal text-muted-foreground tabular-nums md:hidden">
                        {s.memberNumber}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell
                    priority="secondary"
                    nowrap
                    className="text-muted-foreground tabular-nums"
                  >
                    {s.memberNumber ?? "—"}
                  </TableCell>
                  <TableCell priority="tertiary" className="text-muted-foreground">
                    {s.email || s.phone || "—"}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className="text-muted-foreground">
                    {s.joinedAt}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {s.memberNumber === null ? (
                          <AssignMemberNumberButton personId={s.id} />
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          disabled={isPending && pendingCancelId === s.id}
                          onClick={() => handleCancel(s.id)}
                        >
                          {t("cancelMembershipAction")}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar
            page={currentPage}
            pageCount={pageCount}
            onPageChange={goToPage}
            hrefFor={hrefForPage}
          />
        </>
      )}
    </>
  );
}
