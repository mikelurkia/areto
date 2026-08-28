"use client";

import { StatusBadge } from "@/components/status-badge";
import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { STATUS_TONE, type RegistrationStatus } from "@/lib/registration-status";
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
import { ApproveRegistrationDialog } from "@/components/inscripciones/approve-registration-dialog";
import { DeleteRegistrationDialog } from "@/components/inscripciones/delete-registration-dialog";
import { RejectRegistrationDialog } from "@/components/inscripciones/reject-registration-dialog";

export type MemberRequestRow = {
  id: string;
  status: RegistrationStatus;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  /** Solo aplica a `status === "pending"`: sin candidatos a duplicado, ver `socios/page.tsx`. */
  canQuickApprove: boolean;
};

/** Igual que `RegistrationsBrowser` (inscripciones de equipo) pero sin
 * columnas de tutores/fotos, que un socio nunca tiene. */
export function MemberRequestsBrowser({
  registrations,
  canManage,
}: {
  registrations: MemberRequestRow[];
  canManage: boolean;
}) {
  const t = useTranslations("Inscripciones");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("pending");

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
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
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
                  <HoverPrefetchLink href={`/socios/${r.id}`} className="hover:underline">
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
                <TableCell priority="secondary" nowrap className="text-muted-foreground">
                  {r.createdAt}
                </TableCell>
                <TableCell priority="secondary">
                  <StatusBadge tone={STATUS_TONE[r.status]} label={t(`status.${r.status}`)} />
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        {r.canQuickApprove ? (
                          <ApproveRegistrationDialog
                            registrationId={r.id}
                            fullName={`${r.firstName} ${r.lastName}`}
                          />
                        ) : null}
                        <RejectRegistrationDialog
                          registrationId={r.id}
                          fullName={`${r.firstName} ${r.lastName}`}
                        />
                      </div>
                    ) : null}
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
