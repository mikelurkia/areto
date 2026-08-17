import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  ShieldHalf,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { eq, ne, notInArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { memberships, persons, seasons, teams } from "@/db/schema";
import {
  addTeamDocument,
  addTeamNote,
  deleteTeamDocument,
  deleteTeamNote,
  updateTeamDocument,
} from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import { requireUser } from "@/lib/auth";
import { fileTypeLabel } from "@/lib/file-type";
import { computeRosterHealth } from "@/lib/roster-health";
import { getSignedUrls } from "@/lib/supabase/storage";
import { Link } from "@/i18n/navigation";
import { RosterHealth } from "@/components/equipos/roster-health";
import { RenewTeamDialog } from "@/components/equipos/renew-team-dialog";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipTable } from "@/components/equipos/membership-table";
import { DocumentDialog } from "@/components/document-dialog";
import { NotesLog } from "@/components/notes-log";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  return { title: team?.name ?? "Areto" };
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireUser();
  const t = await getTranslations("Equipos");
  const canManage = user.role === "admin" || user.role === "staff";

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      season: true,
      documents: { orderBy: (d, { desc }) => [desc(d.createdAt)] },
      noteEntries: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
    },
  });
  if (!team) notFound();

  const teamMemberships = await db.query.memberships.findMany({
    where: eq(memberships.teamId, teamId),
    with: { person: true },
    orderBy: (memberships, { asc }) => [asc(memberships.jerseyNumber)],
  });

  const otherSeasons = canManage
    ? await db.query.seasons.findMany({
        where: ne(seasons.id, team.seasonId),
        orderBy: (seasons, { desc }) => [desc(seasons.name)],
      })
    : [];

  const memberIds = teamMemberships.map((m) => m.personId);
  const availablePersons = await db.query.persons.findMany({
    where: memberIds.length > 0 ? notInArray(persons.id, memberIds) : undefined,
    orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
    columns: { id: true, firstName: true, lastName: true },
  });

  const [photoUrls, documentFileUrls] = await Promise.all([
    getSignedUrls(PHOTO_BUCKET, teamMemberships, (m) => m.person.photoPath, (m) => m.personId),
    getSignedUrls(TEAM_DOCUMENTS_BUCKET, team.documents, (d) => d.filePath, (d) => d.id),
  ]);

  const { stats: rosterStats, alerts: rosterAlerts } = computeRosterHealth(
    teamMemberships,
    team,
  );

  // Dorsales ocupados por jugadores (para el mapa de dorsales del diálogo).
  const takenJerseys = teamMemberships
    .filter((m) => m.role === "player" && m.jerseyNumber !== null)
    .map((m) => m.jerseyNumber as number);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/equipos" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToTeams")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-muted-foreground">
            {team.category ? t(`category.${team.category}`) : t("categoryNone")}
            {team.gender ? ` · ${t(`gender.${team.gender}`)}` : ""}
            {" · "}
            {team.season.name}
            {team.minBirthYear !== null && team.maxBirthYear !== null
              ? ` · ${team.minBirthYear}–${team.maxBirthYear}`
              : ""}
          </p>
          {team.federationGroup || team.federationCode ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {team.federationGroup ?? ""}
              {team.federationGroup && team.federationCode ? " · " : ""}
              {team.federationCode ? t("federationCodeShort", { code: team.federationCode }) : ""}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 print:hidden">
          {user.role !== "member" ? (
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
            <RenewTeamDialog teamId={team.id} teamName={team.name} seasons={otherSeasons} />
          ) : null}
        </div>
      </div>

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

        <TabsContent value="plantilla" keepMounted className="flex flex-col gap-4">
          <div className="flex justify-end print:hidden">
            {canManage ? (
              <MembershipDialog
                mode="create"
                teamId={team.id}
                availablePersons={availablePersons}
                takenJerseys={takenJerseys}
              />
            ) : null}
          </div>

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
              takenJerseysFor={(m) => takenJerseys.filter((n) => n !== m.jerseyNumber)}
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
                return (
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
                      <AvatarFallback>
                        <UserRoundIcon className="size-3" />
                      </AvatarFallback>
                    </Avatar>
                    <Link href={`/personas/${m.personId}`} className="hover:underline">
                      {personName}
                    </Link>
                    {m.isCaptain ? (
                      <Badge variant="outline" title={t("captainLabel")}>
                        {t("captainShort")}
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
