import { cache } from "react";
import { notFound } from "next/navigation";
import {
  BellIcon,
  ClipboardListIcon,
  ShieldHalf,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { memberships, teams } from "@/db/schema";
import {
  addTeamDocument,
  addTeamNote,
  deleteTeamDocument,
  deleteTeamNote,
  updateTeamDocument,
} from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { hasPermission, requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import { fileTypeLabel } from "@/lib/file-type";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { computeRosterHealth } from "@/lib/roster-health";
import { sortRoster } from "@/lib/roster-order";
import { loadSeasonRenewals } from "@/lib/season-renewals";
import { getSignedUrls } from "@/lib/supabase/storage";
import { Link } from "@/i18n/navigation";
import { RosterHealth } from "@/components/equipos/roster-health";
import { categoryRequiresMedicalCheckup } from "@/components/equipos/team-categories";
import { RenewTeamDialog } from "@/components/equipos/renew-team-dialog";
import { formatCents } from "@/lib/money";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipTable } from "@/components/equipos/membership-table";
import { TeamCaptainCard } from "@/components/equipos/team-captain-card";
import { DocumentDialog } from "@/components/document-dialog";
import { NotesLog } from "@/components/notes-log";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PHOTO_BUCKET = "person-photos";
const TEAM_DOCUMENTS_BUCKET = "team-documents";

/**
 * Ficha del equipo. En `cache()` para que `generateMetadata` y la página
 * compartan una única consulta por petición, en vez de lanzar dos.
 */
const getTeam = cache((teamId: string) =>
  db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      season: true,
      documents: { orderBy: (d, { desc }) => [desc(d.createdAt)] },
      noteEntries: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return { title: team?.name ?? "Areto" };
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; teamId: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string }>;
}) {
  const { locale, teamId } = await params;
  const { from, fromLabel } = await searchParams;
  const backHref = resolveBackHref(from, "/equipos");
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("equipos.view");
  const t = await getTranslations("Equipos");
  const canManage = hasPermission(user, "equipos.manage");

  // Primera tanda, en paralelo: nada de esto depende del resto. Temporadas y
  // personas se traen completas y se filtran en memoria (pocas filas) para no
  // encadenar consultas que esperen a `team` o a las membresías.
  const [team, roster, allSeasons, allPersons] = await Promise.all([
    getTeam(teamId),
    db.query.memberships.findMany({
      where: eq(memberships.teamId, teamId),
      with: { person: true },
      orderBy: (memberships, { asc }) => [asc(memberships.jerseyNumber)],
    }),
    canManage
      ? db.query.seasons.findMany({
          orderBy: (seasons, { desc }) => [desc(seasons.name)],
        })
      : [],
    db.query.persons.findMany({
      orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
      columns: { id: true, firstName: true, lastName: true },
    }),
  ]);
  if (!team) notFound();

  // Orden de plantilla: cuerpo técnico primero y jugadores por puesto
  // (ver `sortRoster`); el dorsal solo desempata dentro de cada grupo.
  const teamMemberships = sortRoster(roster);

  const otherSeasons = allSeasons.filter((season) => season.id !== team.seasonId);

  const memberIds = new Set(teamMemberships.map((m) => m.personId));
  const availablePersons = allPersons.filter((person) => !memberIds.has(person.id));

  // `loadSeasonRenewals` va aparte de las firmas de URLs: por debajo dispara
  // sus propias queries (cruza plantilla e inscripciones), y sumarlas al
  // mismo `Promise.all` es justo el patrón de concurrencia que causó el
  // cuelgue del dashboard — como ya está cacheada (`"use cache"`), el coste
  // real de secuenciarla solo se paga en cache-miss.
  const [photoUrls, documentFileUrls] = await Promise.all([
    // Solo hace falta el avatar en miniatura aquí; el original se ve/descarga
    // desde la ficha de cada persona.
    getSignedUrls(
      PHOTO_BUCKET,
      teamMemberships,
      (m) => (m.person.photoPath ? personPhotoThumbPath(m.person.photoPath) : null),
      (m) => m.personId,
    ),
    getSignedUrls(TEAM_DOCUMENTS_BUCKET, team.documents, (d) => d.filePath, (d) => d.id),
  ]);
  const seasonRenewals = await loadSeasonRenewals(team.seasonId);
  const teamWebRegistration = seasonRenewals.rows.filter((r) => r.teamId === team.id);
  const teamWebRegistrationMissing = teamWebRegistration.filter(
    (r) => r.status === "missing" || r.status === "rejected",
  ).length;
  const webRegistrationStatusByPersonId = new Map(
    teamWebRegistration.map((r) => [r.personId, r.status]),
  );

  const { stats: rosterStats, alerts: rosterAlerts } = computeRosterHealth(
    teamMemberships,
    team,
  );

  // Capitanía: el brazalete lo lleva un jugador, así que el selector solo
  // ofrece jugadores, ordenados por nombre.
  const captainOptions = teamMemberships
    .filter((m) => m.role === "player")
    .map((m) => ({
      membershipId: m.id,
      name: `${m.person.firstName} ${m.person.lastName}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const captainMembershipId = teamMemberships.find((m) => m.isCaptain)?.id ?? null;

  const backLabel =
    fromLabel && backHref !== "/equipos"
      ? t("backToTeamsFrom", { name: fromLabel })
      : t("backToTeams");

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* La descripción es una sola línea de metadatos —categoría, temporada,
          años y datos federativos— para no comerse el alto de la ficha. */}
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        title={team.name}
        description={[
          team.category ? t(`category.${team.category}`) : t("categoryNone"),
          team.gender ? t(`gender.${team.gender}`) : null,
          team.season.name,
          team.minBirthYear !== null && team.maxBirthYear !== null
            ? `${team.minBirthYear}–${team.maxBirthYear}`
            : null,
          team.playerFeeCents !== null
            ? t(`feePeriodShort.${team.playerFeePeriod}`, {
                amount: formatCents(team.playerFeeCents, locale),
              })
            : null,
          team.federationGroup,
          team.federationCode
            ? t("federationCodeShort", { code: team.federationCode })
            : null,
          !categoryRequiresMedicalCheckup(team.category)
            ? t("noMedicalCheckupRequired")
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        meta={
          team.playerFeeNotes ? (
            <span className="text-xs text-muted-foreground">
              {team.playerFeeNotes}
            </span>
          ) : null
        }
        actions={
          <>
            {hasPermission(user, "equipos.acta") ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/equipos/${team.id}/acta`} />}
                nativeButton={false}
              >
                <ClipboardListIcon data-icon="inline-start" />
                {t("rosterSheetAction")}
              </Button>
            ) : null}
            {canManage ? (
              <RenewTeamDialog
                teamId={team.id}
                teamName={team.name}
                seasons={otherSeasons}
              />
            ) : null}
          </>
        }
      />

      <Tabs defaultValue="plantilla">
        <TabsList>
          <TabsTrigger value="plantilla">
            {t("tabRoster", { count: teamMemberships.length })}
          </TabsTrigger>
          <TabsTrigger value="documentos">
            {t("tabDocuments", { count: team.documents.length })}
          </TabsTrigger>
          <TabsTrigger value="bitacora">
            {t("tabNotesLog", { count: team.noteEntries.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plantilla" keepMounted className="flex flex-col gap-3">
          {/* Capitán y alta de miembro comparten fila: son las dos acciones de
              plantilla y así no ocupan dos bloques distintos. */}
          {canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
              {captainOptions.length > 0 ? (
                <TeamCaptainCard
                  teamId={team.id}
                  players={captainOptions}
                  captainMembershipId={captainMembershipId}
                />
              ) : null}
              <MembershipDialog
                mode="create"
                teamId={team.id}
                availablePersons={availablePersons}
              />
            </div>
          ) : null}

          {teamWebRegistration.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 print:hidden">
              <div className="flex items-center gap-3">
                <BellIcon className="size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t("webRegistrationSectionTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {teamWebRegistrationMissing > 0
                      ? t("webRegistrationSummary", {
                          missing: teamWebRegistrationMissing,
                          total: teamWebRegistration.length,
                        })
                      : t("webRegistrationAllDone")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/temporadas/${team.seasonId}/pendientes?team=${team.id}`} />}
                nativeButton={false}
              >
                {t("viewWebRegistrationAction")}
              </Button>
            </div>
          ) : null}

          {teamMemberships.length > 0 ? (
            <RosterHealth stats={rosterStats} alerts={rosterAlerts} />
          ) : null}

          {teamMemberships.length === 0 ? (
            <SectionPlaceholder
              icon={ShieldHalf}
              title={t("emptyRosterTitle")}
              description={t("emptyRosterDescription")}
            />
          ) : (
            <MembershipTable
              items={teamMemberships}
              canManage={canManage}
              t={t}
              subjectHeader={t("colPerson")}
              nameFor={(m) => `${m.person.firstName} ${m.person.lastName}`}
              renderSubject={(m) => {
                const photoUrl = photoUrls.get(m.personId) ?? null;
                const personName = `${m.person.firstName} ${m.person.lastName}`;
                const birthYear = m.person.birthDate
                  ? Number(m.person.birthDate.slice(0, 4))
                  : null;
                const ageOutOfRange =
                  m.role === "player" &&
                  birthYear !== null &&
                  team.minBirthYear !== null &&
                  team.maxBirthYear !== null &&
                  (birthYear < team.minBirthYear || birthYear > team.maxBirthYear);
                const webRegistrationStatus = webRegistrationStatusByPersonId.get(m.personId);
                const webRegistrationMissing =
                  webRegistrationStatus === "missing" || webRegistrationStatus === "rejected";
                return (
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
                      <AvatarFallback>
                        <UserRoundIcon className="size-3" />
                      </AvatarFallback>
                    </Avatar>
                    <Link
                      href={`/personas/${m.personId}?from=${encodeURIComponent(`/equipos/${team.id}`)}&fromLabel=${encodeURIComponent(team.name)}`}
                      className="hover:underline"
                    >
                      {personName}
                    </Link>
                    {m.isCaptain ? (
                      <Badge variant="outline" title={t("captainLabel")}>
                        {t("captainShort")}
                      </Badge>
                    ) : null}
                    {webRegistrationMissing ? (
                      <Badge variant="destructive" title={t("webRegistrationMissingLabel")}>
                        {t("webRegistrationMissingShort")}
                      </Badge>
                    ) : null}
                    {ageOutOfRange ? (
                      <span
                        title={t("ageOutOfRangeLabel", {
                          year: birthYear!,
                          min: team.minBirthYear!,
                          max: team.maxBirthYear!,
                        })}
                      >
                        <TriangleAlertIcon className="size-4 text-destructive" />
                      </span>
                    ) : null}
                  </div>
                );
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="documentos" keepMounted className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("documentsSection")}
            </h2>
            {canManage ? (
              <DocumentDialog
                mode="create"
                parentId={team.id}
                formKey="teamId"
                namespace="Equipos"
                htmlIdPrefix="team-document"
                addAction={addTeamDocument}
                updateAction={updateTeamDocument}
              />
            ) : null}
          </div>
          {team.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDocumentsDescription")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("documentLabelLabel")}</TableHead>
                  <TableHead>{t("documentTypeColumn")}</TableHead>
                  <TableHead>{t("documentNotesColumn")}</TableHead>
                  <TableHead>{t("documentViewFile")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right">{t("colActions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.documents.map((d) => {
                  const fileUrl = documentFileUrls.get(d.id) ?? null;
                  const typeLabel = fileTypeLabel(d.fileName ?? d.filePath);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell>
                        {typeLabel ? <Badge variant="outline">{typeLabel}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {t("documentViewFile")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {canManage ? (
                        <TableCell className="flex justify-end gap-1">
                          <DocumentDialog
                            mode="edit"
                            namespace="Equipos"
                            htmlIdPrefix="team-document"
                            addAction={addTeamDocument}
                            updateAction={updateTeamDocument}
                            document={{ id: d.id, label: d.label, notes: d.notes }}
                            fileUrl={fileUrl}
                          />
                          <DeleteDocumentDialog
                            id={d.id}
                            label={d.label}
                            namespace="Equipos"
                            deleteAction={deleteTeamDocument}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="bitacora" keepMounted className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("notesLogSection")}
          </h2>
          <NotesLog
            parentId={team.id}
            formKey="teamId"
            namespace="Equipos"
            addAction={addTeamNote}
            deleteAction={deleteTeamNote}
            canManage={canManage}
            notes={team.noteEntries.map((n) => ({
              id: n.id,
              body: n.body,
              authorName: n.authorName,
              createdAt: n.createdAt.toISOString().slice(0, 16).replace("T", " "),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
