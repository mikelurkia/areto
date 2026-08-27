"use client";

import { useMemo, useState } from "react";
import { MailIcon, MessageCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RenewalStatus, SeasonRenewalRow } from "@/lib/season-renewals";
import { mailtoBccLink, mailtoLink, whatsappLink } from "@/lib/contact-links";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Solo tiene sentido avisar de estas dos: son las que no tienen la
// inscripción resuelta (mismo criterio que `missingCount` en season-renewals.ts).
const REMINDABLE_STATUSES: RenewalStatus[] = ["missing", "rejected"];

const STATUS_VARIANT: Record<RenewalStatus, "secondary" | "warning" | "destructive" | "outline"> = {
  approved: "secondary",
  pending: "warning",
  rejected: "destructive",
  missing: "outline",
};

// "Sin inscripción" y "Rechazada" primero: son a quienes hay que avisar.
const STATUS_ORDER: Record<RenewalStatus, number> = {
  missing: 0,
  rejected: 1,
  pending: 2,
  approved: 3,
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SeasonRenewalsTable({
  rows,
  seasonId,
  seasonName,
  locale,
}: {
  rows: SeasonRenewalRow[];
  seasonId: string;
  seasonName: string;
  locale: string;
}) {
  const t = useTranslations("Temporadas");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (byStatus !== 0) return byStatus;
        return a.personName.localeCompare(b.personName, locale);
      }),
    [rows, locale],
  );

  // Solo se puede seleccionar (y avisar en bloque) a quien tiene email: por
  // WhatsApp cada enlace abre un chat 1 a 1, no hay forma de volcarlo en bloque.
  const selectableRows = sortedRows.filter(
    (r) => REMINDABLE_STATUSES.includes(r.status) && r.contactEmail,
  );
  const noEmailCount = sortedRows.filter(
    (r) => REMINDABLE_STATUSES.includes(r.status) && !r.contactEmail,
  ).length;
  const allSelectableSelected =
    selectableRows.length > 0 && selectableRows.every((r) => selectedIds.has(r.personId));

  function toggleSelected(personId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(personId);
      else next.delete(personId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      selectableRows.forEach((r) => (checked ? next.add(r.personId) : next.delete(r.personId)));
      return next;
    });
  }

  const selectedEmails = selectableRows
    .filter((r) => selectedIds.has(r.personId))
    .map((r) => r.contactEmail as string);
  const bulkReminderHref = mailtoBccLink(
    selectedEmails,
    t("bulkReminderEmailSubject", { season: seasonName }),
    t("bulkReminderEmailBody", { season: seasonName }),
  );

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-sm font-medium">
            {t("bulkSelectedCount", { count: selectedIds.size })}
          </span>
          <Button
            variant="outline"
            size="sm"
            render={<a href={bulkReminderHref} />}
            nativeButton={false}
          >
            <MailIcon data-icon="inline-start" />
            {t("bulkReminderAction", { count: selectedEmails.length })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            {t("bulkClearSelection")}
          </Button>
          <p className="w-full text-xs text-muted-foreground">{t("bulkReminderNote")}</p>
        </div>
      ) : null}
      {noEmailCount > 0 ? (
        <p className="text-sm text-muted-foreground">{t("bulkNoEmailWarning", { count: noEmailCount })}</p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              {selectableRows.length > 0 ? (
                <Checkbox
                  checked={allSelectableSelected}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  aria-label={t("bulkSelectAllSr")}
                />
              ) : null}
            </TableHead>
            <TableHead>{t("colName")}</TableHead>
            <TableHead>{t("colTeam")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colContact")}</TableHead>
            <TableHead>{t("colReminder")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => {
            const canRemind = REMINDABLE_STATUSES.includes(row.status);
            const canSelect = canRemind && Boolean(row.contactEmail);
            const message = t("reminderMessage", {
              contactName: row.contactName,
              personName: row.personName,
              team: row.teamName,
              season: seasonName,
            });
            return (
              <TableRow key={row.personId}>
                <TableCell>
                  {canSelect ? (
                    <Checkbox
                      checked={selectedIds.has(row.personId)}
                      onCheckedChange={(checked) => toggleSelected(row.personId, checked === true)}
                      aria-label={t("bulkSelectRowSr", { name: row.personName })}
                    />
                  ) : null}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/personas/${row.personId}?from=${encodeURIComponent(`/temporadas/${seasonId}/pendientes`)}&fromLabel=${encodeURIComponent(seasonName)}`}
                    className="hover:underline"
                  >
                    {row.personName}
                  </Link>
                </TableCell>
                <TableCell>{row.teamName}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{t(`status${capitalize(row.status)}`)}</Badge>
                </TableCell>
                <TableCell>
                  {row.contactPhone || row.contactEmail ? (
                    <div className="flex flex-col text-sm">
                      <span>{row.contactName}</span>
                      <span className="text-muted-foreground">
                        {[row.contactPhone, row.contactEmail].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("noContact")}</span>
                  )}
                </TableCell>
                <TableCell>
                  {canRemind && (row.contactPhone || row.contactEmail) ? (
                    <div className="flex items-center gap-0.5">
                      {row.contactPhone ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          render={
                            <a href={whatsappLink(row.contactPhone, message)} target="_blank" rel="noreferrer" />
                          }
                          nativeButton={false}
                          title={t("remindWhatsappAction")}
                          aria-label={t("remindWhatsappAction")}
                        >
                          <MessageCircleIcon />
                        </Button>
                      ) : null}
                      {row.contactEmail ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          render={
                            <a
                              href={mailtoLink(
                                row.contactEmail,
                                t("reminderEmailSubject", { personName: row.personName }),
                                message,
                              )}
                            />
                          }
                          nativeButton={false}
                          title={t("remindEmailAction")}
                          aria-label={t("remindEmailAction")}
                        >
                          <MailIcon />
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
