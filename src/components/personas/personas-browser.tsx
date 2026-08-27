"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  DownloadIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  SearchIcon,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  bulkAddToTeam,
  bulkSetMember,
} from "@/app/[locale]/(app)/personas/actions";
import {
  emailsForSelection,
  exportPersonRows,
} from "@/app/[locale]/(app)/personas/list-actions";
import { calculateAge, isMinor } from "@/lib/age";
import { useFilterParams, useSearchText } from "@/hooks/use-filter-params";
import { downloadCsv } from "@/lib/csv";
import { whatsappLink } from "@/lib/contact-links";
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
  postalCode: string | null;
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

/** Equipos visibles por fila antes de resumir el resto en un «+N». */
const MAX_TEAM_BADGES = 2;

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = {
  q: "",
  equipo: "all",
  rol: "all",
  caduca: "all",
  docs: "all",
  etiqueta: "all",
  pagina: "1",
};

export function PersonasBrowser({
  persons,
  total,
  pageCount,
  page: currentPage,
  teamOptions,
  tagOptions,
  canManage,
}: {
  /** Solo las filas de la página actual: el filtrado y el troceado los hace SQL. */
  persons: PersonRow[];
  total: number;
  pageCount: number;
  page: number;
  teamOptions: TeamOption[];
  tagOptions: string[];
  canManage: boolean;
}) {
  const t = useTranslations("Personas");
  const tEquipos = useTranslations("Equipos");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS, { navigate: true });
  const { equipo: team, rol: role, caduca: expiry, docs, etiqueta: tag } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTeam, setBulkTeam] = useState("");
  const [bulkRole, setBulkRole] = useState<"player" | "coach" | "staff">("player");
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const searchParams = useSearchParams();

  // Al abrir la pantalla el gesto habitual es buscar, así que el cursor ya
  // está en el filtro. `preventScroll` evita el salto de página en móvil.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
  }, []);

  // Ni `filtered` ni `expiryCutoff`: los diez filtros se aplican en la
  // consulta (`src/lib/person-list.ts`), así que `persons` ya son las filas
  // que toca pintar.

  // La exportación sigue significando "todo lo que casa con los filtros", no
  // solo la página: ahora esas filas las devuelve el servidor, porque el
  // navegador ya no tiene el resto.
  function handleExportCsv() {
    startExportTransition(async () => {
      const rows = await exportPersonRows(Object.fromEntries(searchParams));
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
      downloadCsv(
        "personas.csv",
        headers,
        rows.map((p) => [
          `${p.firstName} ${p.lastName}`,
          p.memberNumber !== null ? String(p.memberNumber) : "",
          p.nationalId ?? "",
          p.memberships.map((m) => m.team.name).join(" / "),
          p.guardians.map((g) => `${g.firstName} ${g.lastName}`).join(" / "),
          p.email ?? "",
          p.phone ?? "",
          p.isMember ? t("memberBadge") : "",
        ]),
      );
    });
  }

  const allPageSelected =
    persons.length > 0 && persons.every((p) => selectedIds.has(p.id));

  // Emails de la selección, para el envío masivo con copia oculta (BCC). Se
  // piden al servidor: la selección se conserva al cambiar de página, así que
  // puede incluir personas que ya no están en `persons`.
  const [fetchedEmails, setFetchedEmails] = useState<string[]>([]);
  useEffect(() => {
    if (selectedIds.size === 0) return;
    let cancelled = false;
    emailsForSelection([...selectedIds]).then((emails) => {
      if (!cancelled) setFetchedEmails(emails);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIds]);
  // Sin selección la lista se vacía por derivación, no con un `setState` en el
  // cuerpo del efecto (renders en cascada, y lo prohíbe el lint).
  const bulkEmails = selectedIds.size === 0 ? [] : fetchedEmails;
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
      persons.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)));
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

  // Cambiar un filtro vuelve a la primera página: la que se estuviera viendo
  // ya no significa lo mismo sobre una lista distinta.
  function handleQueryChange(value: string) {
    setQuery(value);
    setFilters({ pagina: "1" });
  }
  function handleTeamChange(value: string | null) {
    setFilters({ equipo: value ?? "all", pagina: "1" });
  }
  function handleRoleChange(value: string | null) {
    setFilters({ rol: value ?? "all", pagina: "1" });
  }
  function handleExpiryChange(value: string | null) {
    setFilters({ caduca: value ?? "all", pagina: "1" });
  }
  function handleDocsChange(value: string | null) {
    setFilters({ docs: value ?? "all", pagina: "1" });
  }
  function handleTagChange(value: string | null) {
    setFilters({ etiqueta: value ?? "all", pagina: "1" });
  }
  function goToPage(next: number) {
    setFilters({ pagina: String(Math.min(Math.max(1, next), pageCount)) });
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
                if (value === "minorWithoutGuardian") return t("filterRoleMinorWithoutGuardian");
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
            <SelectItem value="minorWithoutGuardian">
              {t("filterRoleMinorWithoutGuardian")}
            </SelectItem>
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
        {/* La exportación ya va al servidor a por las filas, así que puede
            tardar: deshabilitado mientras está en vuelo. */}
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

      {total === 0 ? (
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
              {persons.map((person) => {
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
                        {person.birthDate && isMinor(person.birthDate) ? (
                          <Badge variant="outline" className="text-xs">
                            {t("minorTag")}
                          </Badge>
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
                          <PersonDialog mode="edit" person={person} photoUrl={null} />
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
                      goToPage(currentPage - 1);
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
                        goToPage(p);
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
                      goToPage(currentPage + 1);
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
