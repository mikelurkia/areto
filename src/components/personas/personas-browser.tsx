"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DownloadIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  SearchIcon,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  bulkAddToTeam,
  bulkSetMember,
} from "@/app/[locale]/(app)/personas/actions";
import { calculateAge } from "@/lib/age";
import { Link } from "@/i18n/navigation";
import { DeletePersonDialog } from "@/components/personas/delete-person-dialog";
import { PersonDialog } from "@/components/personas/person-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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

const PAGE_SIZE = 25;

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  nationalId: string | null;
  isMember: boolean;
  memberNumber: number | null;
  address: string | null;
  city: string | null;
  iban: string | null;
  medicalCertUntil: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
  shoeSize: string | null;
  photoConsent: boolean;
  sepaConsent: boolean;
  notes: string | null;
  guardians: { id: string; firstName: string; lastName: string }[];
  memberships: {
    teamId: string;
    role: string;
    jerseyNumber: number | null;
    team: { name: string };
  }[];
  qualifications: { title: string; expiresOn: string | null }[];
  tags: string[];
  dependentsCount: number;
  isPastMember: boolean;
};

type TeamOption = { id: string; label: string };
type GuardianOption = { id: string; firstName: string; lastName: string };

const EXPIRY_WINDOW_DAYS = 60;

/** Equipos visibles por fila antes de resumir el resto en un «+N». */
const MAX_TEAM_BADGES = 2;

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Enlace wa.me a partir de un teléfono (mejor esfuerzo: solo dígitos). */
function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function PersonasBrowser({
  persons,
  teamOptions,
  guardianOptions,
  tagOptions,
  canManage,
}: {
  persons: PersonRow[];
  teamOptions: TeamOption[];
  guardianOptions: GuardianOption[];
  tagOptions: string[];
  canManage: boolean;
}) {
  const t = useTranslations("Personas");
  const tEquipos = useTranslations("Equipos");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [role, setRole] = useState("all");
  const [expiry, setExpiry] = useState("all");
  const [docs, setDocs] = useState("all");
  const [tag, setTag] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTeam, setBulkTeam] = useState("");
  const [bulkRole, setBulkRole] = useState<"player" | "coach" | "staff">("player");
  const [isBulkPending, startBulkTransition] = useTransition();

  // Al abrir la pantalla el gesto habitual es buscar, así que el cursor ya
  // está en el filtro. `preventScroll` evita el salto de página en móvil.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
  }, []);

  const expiryCutoff = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + EXPIRY_WINDOW_DAYS);
    return cutoff.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filtered = useMemo(() => {
    let result = persons;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((p) =>
        [`${p.firstName} ${p.lastName}`, p.email ?? "", p.nationalId ?? ""].some(
          (haystack) => haystack.toLowerCase().includes(needle),
        ),
      );
    }
    if (team === "none") {
      result = result.filter((p) => p.memberships.length === 0);
    } else if (team !== "all") {
      result = result.filter((p) => p.memberships.some((m) => m.teamId === team));
    }
    if (role === "member") {
      result = result.filter((p) => p.isMember);
    } else if (role === "player" || role === "coach" || role === "staff") {
      result = result.filter((p) => p.memberships.some((m) => m.role === role));
    } else if (role === "guardian") {
      result = result.filter((p) => p.dependentsCount > 0);
    }
    if (expiry === "medical") {
      result = result.filter(
        (p) =>
          !p.isPastMember &&
          p.medicalCertUntil !== null &&
          p.medicalCertUntil <= expiryCutoff,
      );
    } else if (expiry === "qualification") {
      result = result.filter(
        (p) =>
          !p.isPastMember &&
          p.qualifications.some((q) => q.expiresOn !== null && q.expiresOn <= expiryCutoff),
      );
    }
    if (docs === "pending") {
      result = result.filter(
        (p) =>
          !p.isPastMember &&
          (!p.photoConsent ||
            p.medicalCertUntil === null ||
            p.medicalCertUntil < today),
      );
    }
    if (tag !== "all") {
      result = result.filter((p) => p.tags.includes(tag));
    }
    return result;
  }, [persons, query, team, role, expiry, expiryCutoff, docs, today, tag]);

  function handleExportCsv() {
    const headers = [
      t("colName"),
      t("memberNumberLabel"),
      t("colNationalId"),
      t("colTeam"),
      t("colGuardian"),
      t("colEmail"),
      t("colPhone"),
      t("memberBadge"),
    ];
    const rows = filtered.map((p) => [
      `${p.firstName} ${p.lastName}`,
      p.memberNumber !== null ? String(p.memberNumber) : "",
      p.nationalId ?? "",
      p.memberships.map((m) => m.team.name).join(" / "),
      p.guardians.map((g) => `${g.firstName} ${g.lastName}`).join(" / "),
      p.email ?? "",
      p.phone ?? "",
      p.isMember ? t("memberBadge") : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "personas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagePersons = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const allPageSelected =
    pagePersons.length > 0 && pagePersons.every((p) => selectedIds.has(p.id));

  // Emails de la selección, para el envío masivo con copia oculta (BCC).
  const bulkEmails = useMemo(
    () =>
      [
        ...new Set(
          persons
            .filter((p) => selectedIds.has(p.id) && p.email)
            .map((p) => p.email as string),
        ),
      ],
    [persons, selectedIds],
  );
  const bulkEmailHref = `mailto:?bcc=${encodeURIComponent(bulkEmails.join(","))}`;

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
      pagePersons.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  }

  function handleBulkSetMember(isMember: boolean) {
    const ids = [...selectedIds];
    startBulkTransition(async () => {
      await bulkSetMember(ids, isMember);
      toast.success(t("bulkMemberUpdated"));
      setSelectedIds(new Set());
    });
  }

  function handleBulkAddToTeam() {
    if (!bulkTeam) return;
    const ids = [...selectedIds];
    startBulkTransition(async () => {
      await bulkAddToTeam(ids, bulkTeam, bulkRole);
      toast.success(t("bulkAddedToTeam"));
      setSelectedIds(new Set());
      setBulkTeam("");
      setBulkRole("player");
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }
  function handleTeamChange(value: string | null) {
    setTeam(value ?? "all");
    setPage(1);
  }
  function handleRoleChange(value: string | null) {
    setRole(value ?? "all");
    setPage(1);
  }
  function handleExpiryChange(value: string | null) {
    setExpiry(value ?? "all");
    setPage(1);
  }
  function handleDocsChange(value: string | null) {
    setDocs(value ?? "all");
    setPage(1);
  }
  function handleTagChange(value: string | null) {
    setTag(value ?? "all");
    setPage(1);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-56 pl-8"
          />
        </div>
        <Select value={team} onValueChange={handleTeamChange}>
          <SelectTrigger aria-label={t("filterTeamLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "all") return t("filterTeamAll");
                if (value === "none") return t("filterTeamNone");
                return (
                  teamOptions.find((option) => option.id === value)?.label ??
                  t("filterTeamAll")
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterTeamAll")}</SelectItem>
            <SelectItem value="none">{t("filterTeamNone")}</SelectItem>
            {teamOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={handleRoleChange}>
          <SelectTrigger aria-label={t("filterRoleLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "member") return t("memberBadge");
                if (value === "player" || value === "coach" || value === "staff") {
                  return tEquipos(`roleOption.${value}`);
                }
                if (value === "guardian") return t("filterRoleGuardian");
                return t("filterRoleAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterRoleAll")}</SelectItem>
            <SelectItem value="member">{t("memberBadge")}</SelectItem>
            <SelectItem value="player">{tEquipos("roleOption.player")}</SelectItem>
            <SelectItem value="coach">{tEquipos("roleOption.coach")}</SelectItem>
            <SelectItem value="staff">{tEquipos("roleOption.staff")}</SelectItem>
            <SelectItem value="guardian">{t("filterRoleGuardian")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={expiry} onValueChange={handleExpiryChange}>
          <SelectTrigger aria-label={t("filterExpiryLabel")}>
            <SelectValue>
              {(value: string) => {
                if (value === "medical") return t("filterExpiryMedical");
                if (value === "qualification") return t("filterExpiryQualification");
                return t("filterExpiryAll");
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterExpiryAll")}</SelectItem>
            <SelectItem value="medical">{t("filterExpiryMedical")}</SelectItem>
            <SelectItem value="qualification">{t("filterExpiryQualification")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docs} onValueChange={handleDocsChange}>
          <SelectTrigger aria-label={t("filterDocsLabel")}>
            <SelectValue>
              {(value: string) =>
                value === "pending" ? t("filterDocsPending") : t("filterDocsAll")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterDocsAll")}</SelectItem>
            <SelectItem value="pending">{t("filterDocsPending")}</SelectItem>
          </SelectContent>
        </Select>
        {tagOptions.length > 0 ? (
          <Select value={tag} onValueChange={handleTagChange}>
            <SelectTrigger aria-label={t("filterTagLabel")}>
              <SelectValue>
                {(value: string) =>
                  value === "all" ? (
                    t("filterTagAll")
                  ) : (
                    <span className="capitalize">{value}</span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterTagAll")}</SelectItem>
              {tagOptions.map((option) => (
                <SelectItem key={option} value={option} className="capitalize">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button variant="outline" className="ml-auto" onClick={handleExportCsv}>
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
            disabled={isBulkPending}
            onClick={() => handleBulkSetMember(true)}
          >
            {t("bulkMarkMember")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isBulkPending}
            onClick={() => handleBulkSetMember(false)}
          >
            {t("bulkMarkNonMember")}
          </Button>
          <Select value={bulkTeam} onValueChange={(v) => setBulkTeam(v ?? "")}>
            <SelectTrigger className="w-48" aria-label={t("bulkAddToTeamLabel")}>
              <SelectValue placeholder={t("bulkSelectTeamPlaceholder")}>
                {(value: string) =>
                  teamOptions.find((o) => o.id === value)?.label ??
                  t("bulkSelectTeamPlaceholder")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {teamOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={bulkRole}
            onValueChange={(v) => setBulkRole((v as typeof bulkRole) ?? "player")}
          >
            <SelectTrigger className="w-36" aria-label={tEquipos("roleLabel")}>
              <SelectValue>
                {(value: string) => tEquipos(`roleOption.${value}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="player">{tEquipos("roleOption.player")}</SelectItem>
              <SelectItem value="coach">{tEquipos("roleOption.coach")}</SelectItem>
              <SelectItem value="staff">{tEquipos("roleOption.staff")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={isBulkPending || !bulkTeam}
            onClick={handleBulkAddToTeam}
          >
            {t("bulkAddToTeamAction")}
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

      {filtered.length === 0 ? (
        <SectionPlaceholder
          icon={Users}
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <>
          {/* Una fila por persona: celdas a `py-1` y todo el contenido en línea. */}
          <Table className="[&_td]:py-1">
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
                <TableHead>{t("colNationalId")}</TableHead>
                <TableHead>{t("colTeam")}</TableHead>
                <TableHead>{t("colContact")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                {canManage ? (
                  <TableHead className="text-right">
                    {t("colActions")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagePersons.map((person) => {
                const fullName = `${person.firstName} ${person.lastName}`;
                const visibleTeams = person.memberships.slice(0, MAX_TEAM_BADGES);
                const hiddenTeams = person.memberships.slice(MAX_TEAM_BADGES);
                const membershipRoles = [
                  ...new Set(person.memberships.map((m) => m.role)),
                ];
                const hasStatus = person.isMember || membershipRoles.length > 0;
                return (
                  <TableRow key={person.id}>
                    {canManage ? (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(person.id)}
                          onCheckedChange={(checked) =>
                            toggleSelected(person.id, checked === true)
                          }
                          aria-label={t("bulkSelectRowSr", { name: fullName })}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>
                            {initials(person.firstName, person.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <Link
                          href={`/personas/${person.id}`}
                          className="hover:underline"
                        >
                          {fullName}
                        </Link>
                        {person.birthDate ? (
                          <span className="text-xs font-normal text-muted-foreground">
                            {t("ageYears", {
                              count: calculateAge(person.birthDate),
                            })}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {person.nationalId ?? "—"}
                    </TableCell>
                    <TableCell>
                      {person.memberships.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {visibleTeams.map((m) => (
                            <Badge
                              key={m.teamId}
                              variant="outline"
                              className="font-normal"
                            >
                              {m.jerseyNumber
                                ? `${m.team.name} · #${m.jerseyNumber}`
                                : m.team.name}
                            </Badge>
                          ))}
                          {hiddenTeams.length > 0 ? (
                            <Badge
                              variant="outline"
                              className="font-normal"
                              title={hiddenTeams.map((m) => m.team.name).join(", ")}
                            >
                              +{hiddenTeams.length}
                            </Badge>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {person.phone || person.email ? (
                        <div className="flex items-center gap-0.5">
                          {person.phone ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              render={<a href={`tel:${person.phone}`} />}
                              nativeButton={false}
                              title={person.phone}
                              aria-label={`${t("colPhone")}: ${person.phone}`}
                            >
                              <PhoneIcon />
                            </Button>
                          ) : null}
                          {person.phone ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              render={
                                <a
                                  href={whatsappLink(person.phone)}
                                  target="_blank"
                                  rel="noreferrer"
                                />
                              }
                              nativeButton={false}
                              title={t("whatsappAction")}
                              aria-label={t("whatsappAction")}
                            >
                              <MessageCircleIcon />
                            </Button>
                          ) : null}
                          {person.email ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              render={<a href={`mailto:${person.email}`} />}
                              nativeButton={false}
                              title={person.email}
                              aria-label={`${t("colEmail")}: ${person.email}`}
                            >
                              <MailIcon />
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasStatus ? (
                        <div className="flex items-center gap-1">
                          {person.isMember ? (
                            <Badge variant="secondary">{t("memberBadge")}</Badge>
                          ) : null}
                          {membershipRoles.map((role) => (
                            <Badge key={role} variant="secondary">
                              {tEquipos(`roleOption.${role}`)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <PersonDialog
                            mode="edit"
                            person={person}
                            photoUrl={null}
                            guardianOptions={guardianOptions}
                          />
                          <DeletePersonDialog id={person.id} name={fullName} />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {pageCount > 1 ? (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    text={t("paginationPrevious")}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    href="#"
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === currentPage}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    text={t("paginationNext")}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(pageCount, p + 1));
                    }}
                    href="#"
                    className={
                      currentPage === pageCount
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}
    </>
  );
}
