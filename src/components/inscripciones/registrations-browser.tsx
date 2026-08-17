"use client";

import { useMemo, useState } from "react";
import { InboxIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
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

type RegistrationRow = {
  id: string;
  kind: "player" | "coach";
  status: "pending" | "approved" | "rejected";
  firstName: string;
  lastName: string;
  nationalId: string | null;
  email: string | null;
  phone: string | null;
  guardiansCount: number;
  photosCount: number;
  createdAt: string;
};

const STATUS_VARIANT = {
  pending: "warning",
  approved: "secondary",
  rejected: "destructive",
} as const;

export function RegistrationsBrowser({ registrations }: { registrations: RegistrationRow[] }) {
  const t = useTranslations("Inscripciones");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("all");

  const filtered = useMemo(() => {
    let result = registrations;
    if (status !== "all") result = result.filter((r) => r.status === status);
    if (kind !== "all") result = result.filter((r) => r.kind === kind);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((r) =>
        [`${r.firstName} ${r.lastName}`, r.nationalId ?? "", r.email ?? ""].some((h) =>
          h.toLowerCase().includes(needle),
        ),
      );
    }
    return result;
  }, [registrations, query, status, kind]);

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
        <Select value={kind} onValueChange={(v) => setKind(v ?? "all")}>
          <SelectTrigger aria-label={t("filterKindLabel")}>
            <SelectValue>
              {(value: string) =>
                value === "all"
                  ? t("filterKindAll")
                  : t(`kind.${value}` as "kind.player")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterKindAll")}</SelectItem>
            <SelectItem value="player">{t("kind.player")}</SelectItem>
            <SelectItem value="coach">{t("kind.coach")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          icon={InboxIcon}
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colKind")}</TableHead>
              <TableHead>{t("colNationalId")}</TableHead>
              <TableHead>{t("colContact")}</TableHead>
              <TableHead>{t("colGuardians")}</TableHead>
              <TableHead>{t("colPhotos")}</TableHead>
              <TableHead>{t("colDate")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/inscripciones/${r.id}`} className="hover:underline">
                    {r.firstName} {r.lastName}
                  </Link>
                </TableCell>
                <TableCell>{t(`kind.${r.kind}`)}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {r.nationalId ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.email || r.phone || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.guardiansCount > 0 ? r.guardiansCount : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.photosCount === 3 ? "secondary" : r.photosCount === 0 ? "destructive" : "warning"}>
                    {t("photosCount", { count: r.photosCount })}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.createdAt}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
