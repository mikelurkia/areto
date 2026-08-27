"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { DownloadIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  assignNextMemberNumber,
  bulkSetMember,
} from "@/app/[locale]/(app)/personas/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
const FILTER_DEFAULTS = { q: "" };

export function SociosBrowser({
  socios,
  canManage,
}: {
  socios: SocioRow[];
  canManage: boolean;
}) {
  const t = useTranslations("Socios");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!query.trim()) return socios;
    const needle = query.trim().toLowerCase();
    return socios.filter((s) =>
      [`${s.firstName} ${s.lastName}`, s.email ?? "", s.phone ?? ""].some((h) =>
        h.toLowerCase().includes(needle),
      ),
    );
  }, [socios, query]);

  /** Exporta lo que se está viendo, no la tabla entera: el filtro es parte de
   * lo que se quiere llevar a la hoja de cálculo. */
  function handleExportCsv() {
    const headers = [
      t("colName"),
      t("colMemberNumber"),
      t("colContact"),
      t("colJoinedAt"),
    ];
    const rows = filtered.map((s) => [
      `${s.firstName} ${s.lastName}`,
      s.memberNumber !== null ? String(s.memberNumber) : "",
      s.email || s.phone || "",
      s.joinedAt,
    ]);
    downloadCsv("socios.csv", headers, rows);
  }

  function handleCancel(personId: string) {
    setPendingCancelId(personId);
    startTransition(async () => {
      await bulkSetMember([personId], false);
      toast.success(t("memberCancelled"));
      setPendingCancelId(null);
    });
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
          disabled={filtered.length === 0}
        >
          <DownloadIcon data-icon="inline-start" />
          {t("exportCsvAction")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          icon={UsersIcon}
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colMemberNumber")}</TableHead>
              <TableHead>{t("colContact")}</TableHead>
              <TableHead>{t("colJoinedAt")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">{t("colActions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/personas/${s.id}?from=${encodeURIComponent("/socios")}`}
                    className="hover:underline"
                  >
                    {s.firstName} {s.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {s.memberNumber ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.email || s.phone || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.joinedAt}</TableCell>
                {canManage ? (
                  <TableCell className="flex justify-end gap-2">
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
