"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { PaginationBar } from "@/components/pagination-bar";
import { SectionPlaceholder } from "@/components/section-placeholder";
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
import { useFilterParams } from "@/hooks/use-filter-params";
import { usePagedRows } from "@/hooks/use-paged-rows";

export type AuditLogRow = {
  id: string;
  createdAt: string;
  action: "create" | "update" | "delete" | "approve" | "reject";
  entityType:
    | "person_medical_checkup"
    | "person_injury_report"
    | "person_banking"
    | "user"
    | "user_role"
    | "role_permissions"
    | "registration";
  entityId: string;
  actorEmail: string | null;
  actorName: string | null;
};

const ENTITY_TYPES = [
  "person_medical_checkup",
  "person_injury_report",
  "person_banking",
  "user",
  "user_role",
  "role_permissions",
  "registration",
] as const;

const ACTIONS = ["create", "update", "delete", "approve", "reject"] as const;

const FILTER_DEFAULTS = { tipo: "all", accion: "all" };

export function AuditLogBrowser({ rows }: { rows: AuditLogRow[] }) {
  const t = useTranslations("Administracion");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filters.tipo === "all" || r.entityType === filters.tipo) &&
          (filters.accion === "all" || r.action === filters.accion),
      ),
    [rows, filters.tipo, filters.accion],
  );

  const { page, pageCount, setPage, pageRows } = usePagedRows(filtered);

  const dateFmt = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.tipo}
          onValueChange={(value) => setFilters({ tipo: value ?? "all" })}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("auditFilterEntityAll")}</SelectItem>
            {ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`auditEntityType.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.accion}
          onValueChange={(value) => setFilters({ accion: value ?? "all" })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("auditFilterActionAll")}</SelectItem>
            {ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {t(`auditAction.${action}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("auditNoResultsTitle")}
          description={t("auditNoResultsDescription")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auditColDate")}</TableHead>
                <TableHead priority="secondary">{t("auditColActor")}</TableHead>
                <TableHead>{t("auditColAction")}</TableHead>
                <TableHead priority="tertiary">{t("auditColEntity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell nowrap className="text-muted-foreground">
                    {dateFmt.format(new Date(row.createdAt))}
                  </TableCell>
                  <TableCell priority="secondary">
                    {row.actorName || row.actorEmail || t("auditActorUnknown")}
                  </TableCell>
                  <TableCell>{t(`auditAction.${row.action}`)}</TableCell>
                  <TableCell priority="tertiary" className="text-muted-foreground">
                    {t(`auditEntityType.${row.entityType}`)}
                    <span className="ml-1 font-mono text-xs">
                      {row.entityId.slice(0, 8)}
                    </span>
                  </TableCell>
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
