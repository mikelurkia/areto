"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
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
import type { TeamCategoryValue } from "@/components/equipos/team-categories";
import { calculateAge, isMinor } from "@/lib/age";
import {
  hasActiveFilters,
  useFilterParams,
  useSearchText,
} from "@/hooks/use-filter-params";
import { whatsappLink } from "@/lib/contact-links";
import { ALERT_ICON, ALERT_TONE, personAlerts } from "@/lib/person-status";
import { TONE_ICON } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import { BulkActionsBar } from "@/components/bulk-actions-bar";
import { EmptyValue } from "@/components/empty-value";
import { FiltersBar } from "@/components/filters-bar";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { ExportMenu } from "@/components/export-menu";
import { PaginationBar } from "@/components/pagination-bar";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { ContactExportItems } from "@/components/personas/contact-export";
import { DeletePersonDialog } from "@/components/personas/delete-person-dialog";
import { PersonDialog } from "@/components/personas/person-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    team: {
      name: string;
      category: TeamCategoryValue | null;
      season: { isCurrent: boolean };
    };
  }[];
  qualifications: { title: string; expiresOn: string | null }[];
  tags: string[];
  dependentsCount: number;
  isPastMember: boolean;
};

type TeamOption = { id: string; label: string };

/** Equipos visibles por fila antes de resumir el resto en un «+N». */
const MAX_TEAMS = 2;

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
  photoUrls,
  total,
  pageCount,
  page: currentPage,
  teamOptions,
  tagOptions,
  canManage,
  canManageBanking,
}: {
  /** Solo las filas de la página actual: el filtrado y el troceado los hace SQL. */
  persons: PersonRow[];
  /** Miniatura por id de persona; sin entrada, se pintan las iniciales. */
  photoUrls: Record<string, string>;
  total: number;
  pageCount: number;
  page: number;
  teamOptions: TeamOption[];
  tagOptions: string[];
  canManage: boolean;
  canManageBanking: boolean;
}) {
  const t = useTranslations("Personas");
  const tEquipos = useTranslations("Equipos");
  const [filters, setFilters, isFiltering] = useFilterParams(FILTER_DEFAULTS, {
    navigate: true,
  });
  const { equipo: team, rol: role, caduca: expiry, docs, etiqueta: tag } = filters;
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTeam, setBulkTeam] = useState("");
  const [bulkRole, setBulkRole] = useState<"player" | "coach" | "staff">("player");
  const [isBulkPending, startBulkTransition] = useTransition();
  const searchParams = useSearchParams();
  const pathname = usePathname();

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
  async function exportData() {
    const rows = await exportPersonRows(Object.fromEntries(searchParams));
    return {
      headers: [
        t("colName"),
        t("memberNumberLabel"),
        t("colNationalId"),
        t("colTeam"),
        t("colGuardian"),
        t("colEmail"),
        t("colPhone"),
        t("memberBadge"),
      ],
      rows: rows.map((p) => [
        `${p.firstName} ${p.lastName}`,
        p.memberNumber !== null ? String(p.memberNumber) : "",
        p.nationalId ?? "",
        p.memberships.map((m) => m.team.name).join(" / "),
        p.guardians.map((g) => `${g.firstName} ${g.lastName}`).join(" / "),
        p.email ?? "",
        p.phone ?? "",
        p.isMember ? t("memberBadge") : "",
      ]),
    };
  }

  /**
   * A quién exporta el menú de datos de contacto: si hay filas marcadas, esas;
   * si no, todo lo que casa con los filtros. Se calcula al pulsar y no al
   * pintar, porque para entonces la selección puede ser otra.
   */
  function contactExportScope() {
    return selectedIds.size > 0
      ? { ids: [...selectedIds] }
      : { searchParams: Object.fromEntries(searchParams) };
  }

  const filtersActive = hasActiveFilters(filters, FILTER_DEFAULTS);

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
  /** Todo a su valor de partida: `setFilters` borra de la URL lo que iguala al defecto. */
  function clearFilters() {
    setQuery("");
    setFilters(FILTER_DEFAULTS);
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
      <FiltersBar
        trailing={
          /* Un solo menú con los dos juegos de datos de esta pantalla: el
             listado tal cual y los datos de contacto. Fuera de la barra de
             acciones masivas a propósito: aquella pide `canManage` y esto se
             resuelve con permiso de lectura. */
          <ExportMenu
            filename="personas"
            getData={exportData}
            scopeLabel={t("contactExportScopeFiltered")}
          >
            <ContactExportItems
              getScope={contactExportScope}
              scopeLabel={
                selectedIds.size > 0
                  ? t("contactExportScopeSelected", { count: selectedIds.size })
                  : t("contactExportScopeFiltered")
              }
            />
          </ExportMenu>
        }
      >
        <SearchInput
          ref={searchRef}
          value={query}
          onValueChange={handleQueryChange}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("searchClear")}
        />
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
      </FiltersBar>

      {canManage && selectedIds.size > 0 ? (
        <BulkActionsBar
          countLabel={t("bulkSelectedCount", { count: selectedIds.size })}
          clearLabel={t("bulkClearSelection")}
          onClear={() => setSelectedIds(new Set())}
        >
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
        </BulkActionsBar>
      ) : null}

      {/* Cuántas personas hay detrás de estos filtros. Sin esta línea la única
          cifra de la pantalla era la paginación, que con 25 o menos resultados
          ni siquiera se pinta. */}
      {/* Con cero resultados la cifra sobra: lo dice ya el propio vacío, y
          allí es donde va el botón de limpiar. */}
      {total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground print:hidden">
          <span aria-live="polite">{t("resultsCount", { count: total })}</span>
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {total === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        >
          {filtersActive ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          ) : null}
        </SectionPlaceholder>
      ) : (
        /* Mientras el filtro viaja al servidor la tabla sigue siendo la
           anterior: se apaga para que se vea que lo que hay en pantalla ya no
           es la respuesta a lo que se acaba de pedir. */
        <div
          className={cn(
            "flex flex-col gap-6 transition-opacity",
            isFiltering && "opacity-60",
          )}
          aria-busy={isFiltering}
        >
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
                <TableHead priority="tertiary">{t("colNationalId")}</TableHead>
                <TableHead priority="secondary">{t("colTeam")}</TableHead>
                <TableHead className="w-20">{t("colAlerts")}</TableHead>
                <TableHead priority="tertiary">{t("colContact")}</TableHead>
                <TableHead priority="secondary">{t("colStatus")}</TableHead>
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
                const membershipRoles = [
                  ...new Set(person.memberships.map((m) => m.role)),
                ];
                const alerts = personAlerts(person);
                // Equipos como texto, no como badges: un badge por equipo
                // envolvía y estiraba el alto de la fila. Se ven los dos
                // primeros y el resto cuenta como «+N», con la lista completa
                // en el `title`.
                const teamNames = person.memberships.map((m) =>
                  m.jerseyNumber ? `${m.team.name} · #${m.jerseyNumber}` : m.team.name,
                );
                const hiddenTeams = teamNames.length - MAX_TEAMS;
                const teamsLabel = [
                  ...teamNames.slice(0, MAX_TEAMS),
                  ...(hiddenTeams > 0 ? [`+${hiddenTeams}`] : []),
                ].join(" · ");
                // Estado: «socio» se queda como badge —es la distinción que más
                // se busca de un vistazo—, y roles y etiquetas bajan a texto.
                const statusLabel = [
                  ...membershipRoles.map((role) => tEquipos(`roleOption.${role}`)),
                  ...person.tags,
                ].join(" · ");
                // Lo que en móvil desaparece con su columna, resumido en la
                // misma línea del nombre y truncado.
                const mobileSummary = [
                  person.nationalId,
                  teamNames.join(" · "),
                  [
                    ...(person.isMember ? [t("memberBadge")] : []),
                    ...membershipRoles.map((role) => tEquipos(`roleOption.${role}`)),
                  ].join(" · "),
                ]
                  .filter(Boolean)
                  .join(" · ");
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
                    <TableCell className="max-w-0 font-medium">
                      {/* Una sola línea: el nombre trunca y todo lo demás va a
                          su lado, nunca debajo. */}
                      <div className="flex items-center gap-2">
                        <HoverPrefetchLink
                          href={`/personas/${person.id}`}
                          /* Quien ya no está en ningún equipo de la temporada
                             activa se apaga en vez de ganar otro badge. */
                          className={cn(
                            "truncate hover:underline",
                            person.isPastMember && "text-muted-foreground",
                          )}
                        >
                          {fullName}
                        </HoverPrefetchLink>
                        {person.birthDate ? (
                          <span className="shrink-0 text-xs font-normal text-muted-foreground">
                            {t("ageYears", {
                              count: calculateAge(person.birthDate),
                            })}
                          </span>
                        ) : null}
                        {person.birthDate && isMinor(person.birthDate) ? (
                          <StatusBadge
                            tone="neutral"
                            label={t("minorTag")}
                            className="shrink-0"
                          />
                        ) : null}
                        {/* Lo que las columnas escondidas se llevan en
                            pantallas estrechas, en esta misma línea. */}
                        {mobileSummary ? (
                          <span className="truncate text-xs font-normal text-muted-foreground md:hidden">
                            · {mobileSummary}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell
                      priority="tertiary"
                      nowrap
                      className="text-muted-foreground tabular-nums"
                    >
                      {person.nationalId ?? "—"}
                    </TableCell>
                    <TableCell
                      priority="secondary"
                      nowrap
                      className="max-w-0 truncate text-muted-foreground"
                      title={teamNames.join(", ") || undefined}
                    >
                      {teamsLabel || <EmptyValue />}
                    </TableCell>
                    {/* Los avisos no llevan `priority`: son justo lo que no
                        debe desaparecer al estrecharse la pantalla. Como
                        iconos caben en la línea; el texto lo da el `title` y
                        el lector de pantalla lo lee del `sr-only`. */}
                    <TableCell nowrap>
                      {alerts.length > 0 ? (
                        <span className="flex items-center gap-1">
                          {alerts.map((alert) => {
                            const AlertIcon = ALERT_ICON[alert];
                            const label = t(`alert.${alert}`);
                            return (
                              <span
                                key={alert}
                                className={cn(
                                  "inline-flex",
                                  TONE_ICON[ALERT_TONE[alert]],
                                )}
                                title={label}
                              >
                                <AlertIcon className="size-4" aria-hidden />
                                <span className="sr-only">{label}</span>
                              </span>
                            );
                          })}
                        </span>
                      ) : (
                        <EmptyValue />
                      )}
                    </TableCell>
                    <TableCell priority="tertiary">
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
                        <EmptyValue />
                      )}
                    </TableCell>
                    <TableCell
                      priority="secondary"
                      nowrap
                      className="max-w-0 truncate text-muted-foreground"
                      title={statusLabel || undefined}
                    >
                      {person.isMember || statusLabel ? (
                        <span className="flex items-center gap-1.5">
                          {person.isMember ? (
                            <StatusBadge
                              tone="highlight"
                              label={t("memberBadge")}
                              className="shrink-0"
                            />
                          ) : null}
                          {statusLabel ? (
                            <span className="truncate capitalize">{statusLabel}</span>
                          ) : null}
                        </span>
                      ) : (
                        <EmptyValue />
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <PersonDialog
                            mode="edit"
                            person={person}
                            photoUrl={photoUrls[person.id] ?? null}
                            canManageBanking={canManageBanking}
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
          <PaginationBar
            page={currentPage}
            pageCount={pageCount}
            onPageChange={goToPage}
            hrefFor={hrefForPage}
          />
        </div>
      )}
    </>
  );
}
