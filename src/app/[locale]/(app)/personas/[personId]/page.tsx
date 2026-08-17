import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { and, eq, ne } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { personTags, persons } from "@/db/schema";
import {
  addPersonDocument,
  addPersonNote,
  deletePersonDocument,
  deletePersonNote,
  updatePersonDocument,
} from "@/app/[locale]/(app)/personas/actions";
import { requireRole } from "@/lib/auth";
import { calculateAge, isMinor } from "@/lib/age";
import { fileTypeLabel } from "@/lib/file-type";
import { getSignedUrl, getSignedUrls } from "@/lib/supabase/storage";
import { teamSeasonLabel } from "@/lib/team-label";
import { Link } from "@/i18n/navigation";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipTable } from "@/components/equipos/membership-table";
import { AssignMemberNumberButton } from "@/components/personas/assign-member-number-button";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { DeleteQualificationDialog } from "@/components/personas/delete-qualification-dialog";
import { DocumentDialog } from "@/components/document-dialog";
import { FamilyPanel, type FamilyMember } from "@/components/personas/family-panel";
import { PersonDialog } from "@/components/personas/person-dialog";
import { NotesLog } from "@/components/notes-log";
import { PersonTagsEditor } from "@/components/personas/person-tags-editor";
import { QualificationDialog } from "@/components/personas/qualification-dialog";
import { PrintButton } from "@/components/print-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
const QUALIFICATIONS_BUCKET = "person-qualifications";
const DOCUMENTS_BUCKET = "person-documents";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Ficha completa de la persona. En `cache()` para que `generateMetadata` y la
 * página compartan una única consulta por petición, en vez de lanzar dos.
 */
const getPerson = cache((personId: string) =>
  db.query.persons.findFirst({
    where: eq(persons.id, personId),
    with: {
      guardian: true,
      dependents: true,
      memberships: { with: { team: { with: { season: true } } } },
      qualifications: { orderBy: (q, { desc }) => [desc(q.createdAt)] },
      documents: { orderBy: (d, { desc }) => [desc(d.createdAt)] },
      noteEntries: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
      tags: { orderBy: (tag, { asc }) => [asc(tag.tag)] },
    },
  }),
);

/** Persona vista desde el panel de familia: solo lo que pinta una ficha breve. */
type FamilyPerson = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  photoPath: string | null;
};

/**
 * Panel de familia. Vive aparte porque es la parte más lenta de la ficha:
 * consulta las hermanas/os (parentesco derivado del tutor legal) y firma las
 * fotos de todos los familiares. Con su propio <Suspense> ya no retrasa los
 * datos de la persona.
 */
async function FamilySection({
  personId,
  guardianId,
  guardian,
  dependents,
  minorWithoutGuardian,
  minorGuardian,
}: {
  personId: string;
  guardianId: string | null;
  guardian: FamilyPerson | null;
  dependents: FamilyPerson[];
  minorWithoutGuardian: boolean;
  minorGuardian: boolean;
}) {
  // Hermanos/as = otras personas con el mismo tutor legal (no se guarda).
  const siblings = guardianId
    ? await db.query.persons.findMany({
        where: and(eq(persons.guardianId, guardianId), ne(persons.id, personId)),
        orderBy: (p, { asc }) => [asc(p.birthDate)],
      })
    : [];

  // Fotos de todos los familiares en una sola tanda de URLs firmadas.
  const familyPhotoUrls = await getSignedUrls(
    PHOTO_BUCKET,
    [...(guardian ? [guardian] : []), ...siblings, ...dependents],
    (p) => p.photoPath,
    (p) => p.id,
  );

  const toFamilyMember = (p: FamilyPerson): FamilyMember => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    photoUrl: familyPhotoUrls.get(p.id) ?? null,
    phone: p.phone,
    email: p.email,
    ageYears: p.birthDate ? calculateAge(p.birthDate) : null,
    isMinor: isMinor(p.birthDate),
  });

  return (
    <FamilyPanel
      guardian={guardian ? toFamilyMember(guardian) : null}
      siblings={siblings.map(toFamilyMember)}
      dependents={dependents.map(toFamilyMember)}
      minorWithoutGuardian={minorWithoutGuardian}
      minorGuardian={minorGuardian}
    />
  );
}

/** Fallback del panel de familia: etiqueta de sección y una ficha de persona. */
function FamilySectionSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; personId: string }>;
}) {
  const { personId } = await params;
  const person = await getPerson(personId);
  return {
    title: person ? `${person.firstName} ${person.lastName}` : "Areto",
  };
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ locale: string; personId: string }>;
}) {
  const { locale, personId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Personas");
  const tEquipos = await getTranslations("Equipos");
  const canManage = true;

  // Primera tanda: todo lo que no depende de la propia ficha. Los equipos se
  // traen completos y se filtran en memoria (son pocas filas), así esta consulta
  // deja de esperar a que lleguen las membresías de la persona.
  const [person, existingTagRows, allPersons, allTeams] = await Promise.all([
    getPerson(personId),
    db.selectDistinct({ tag: personTags.tag }).from(personTags).orderBy(personTags.tag),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true },
    }),
    db.query.teams.findMany({
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
  ]);
  if (!person) notFound();

  const existingTags = existingTagRows.map((r) => r.tag);

  const memberTeamIds = new Set(person.memberships.map((m) => m.teamId));
  const availableTeamOptions = allTeams
    .filter((team) => !memberTeamIds.has(team.id))
    .map((team) => ({
      id: team.id,
      label: teamSeasonLabel(team, team.season),
    }));

  // Segunda tanda: las firmas de Storage que necesita la ficha ya cargada. Lo de
  // la familia va por su cuenta, en <FamilySection>.
  const [photoUrl, qualificationFileUrls, documentFileUrls] = await Promise.all([
    getSignedUrl(PHOTO_BUCKET, person.photoPath),
    getSignedUrls(QUALIFICATIONS_BUCKET, person.qualifications, (q) => q.filePath, (q) => q.id),
    getSignedUrls(DOCUMENTS_BUCKET, person.documents, (d) => d.filePath, (d) => d.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const fullName = `${person.firstName} ${person.lastName}`;
  const isMinorWithoutGuardian = isMinor(person.birthDate) && !person.guardianId;
  const hasMinorGuardian = !!person.guardian && isMinor(person.guardian.birthDate);

  const membershipsBySeason = new Map<
    string,
    { season: (typeof person.memberships)[number]["team"]["season"]; items: typeof person.memberships }
  >();
  for (const m of person.memberships) {
    const key = m.team.season.id;
    if (!membershipsBySeason.has(key)) {
      membershipsBySeason.set(key, { season: m.team.season, items: [] });
    }
    membershipsBySeason.get(key)!.items.push(m);
  }
  const seasonGroups = [...membershipsBySeason.values()].sort((a, b) => {
    if (a.season.isCurrent !== b.season.isCurrent) return a.season.isCurrent ? -1 : 1;
    return (b.season.startsOn ?? "").localeCompare(a.season.startsOn ?? "");
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/personas" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToPersonas")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
            <AvatarFallback>
              <UserRoundIcon className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              {person.isMember ? (
                <Badge variant="secondary">{t("memberBadge")}</Badge>
              ) : null}
              {[...new Set(person.memberships.map((m) => m.role))].map((role) => (
                <Badge key={role} variant="secondary">
                  {tEquipos(`roleOption.${role}`)}
                </Badge>
              ))}
              {person.dependents.length > 0 ? (
                <Badge variant="secondary">
                  {t("guardianOfBadge", { count: person.dependents.length })}
                </Badge>
              ) : null}
              {isMinorWithoutGuardian ? (
                <Badge variant="destructive" title={t("minorWithoutGuardianWarning")}>
                  <TriangleAlertIcon className="size-3" />
                  {t("minorWithoutGuardianBadge")}
                </Badge>
              ) : null}
              {hasMinorGuardian ? (
                <Badge variant="destructive" title={t("minorGuardianWarning")}>
                  <TriangleAlertIcon className="size-3" />
                  {t("minorGuardianBadge")}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2">
              <PersonTagsEditor
                personId={person.id}
                tags={person.tags}
                existingTags={existingTags}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/personas/${person.id}/carne`} />}
            nativeButton={false}
          >
            <CreditCardIcon data-icon="inline-start" />
            {t("memberCardAction")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/personas/${person.id}/rgpd`} />}
            nativeButton={false}
          >
            <ShieldCheckIcon data-icon="inline-start" />
            {t("rgpdExportAction")}
          </Button>
          <PrintButton label={t("printAction")} />
          {canManage ? (
            <PersonDialog
              mode="edit"
              person={person}
              photoUrl={photoUrl}
              guardianOptions={allPersons}
            />
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("tabGeneral")}</TabsTrigger>
          <TabsTrigger value="familia">{t("tabFamily")}</TabsTrigger>
          <TabsTrigger value="equipos">
            {t("tabTeams", { count: person.memberships.length })}
          </TabsTrigger>
          <TabsTrigger value="titulaciones">
            {t("tabQualifications", { count: person.qualifications.length })}
          </TabsTrigger>
          <TabsTrigger value="documentos">
            {t("tabDocuments", { count: person.documents.length })}
          </TabsTrigger>
          <TabsTrigger value="bitacora">
            {t("tabNotesLog", { count: person.noteEntries.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" keepMounted className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("contactSection")}
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow label={t("emailLabel")} value={person.email} />
                <InfoRow label={t("phoneLabel")} value={person.phone} />
                <InfoRow label={t("addressLabel")} value={person.address} />
                <InfoRow label={t("cityLabel")} value={person.city} />
              </dl>
              {person.email || person.phone ? (
                <div className="flex flex-wrap gap-2 print:hidden">
                  {person.email ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={`mailto:${person.email}`} />}
                      nativeButton={false}
                    >
                      <MailIcon data-icon="inline-start" />
                      {t("emailAction")}
                    </Button>
                  ) : null}
                  {person.phone ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={`tel:${person.phone}`} />}
                      nativeButton={false}
                    >
                      <PhoneIcon data-icon="inline-start" />
                      {t("callAction")}
                    </Button>
                  ) : null}
                  {person.phone ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <a
                          href={`https://wa.me/${person.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                      nativeButton={false}
                    >
                      <MessageCircleIcon data-icon="inline-start" />
                      {t("whatsappAction")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("personalDataSection")}
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow label={t("birthDateLabel")} value={person.birthDate} />
                <InfoRow label={t("nationalIdLabel")} value={person.nationalId} />
                <InfoRow label={t("ibanLabel")} value={person.iban} />
                <InfoRow
                  label={t("medicalCertLabel")}
                  value={person.medicalCertUntil}
                />
                <InfoRow
                  label={t("memberNumberLabel")}
                  value={
                    person.memberNumber ??
                    (person.isMember ? (
                      <span className="print:hidden">
                        <AssignMemberNumberButton personId={person.id} />
                      </span>
                    ) : null)
                  }
                />
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("sizesSection")}
              </h2>
              <dl className="grid grid-cols-3 gap-3">
                <InfoRow label={t("shirtSizeLabel")} value={person.shirtSize} />
                <InfoRow label={t("pantsSizeLabel")} value={person.pantsSize} />
                <InfoRow label={t("shoeSizeLabel")} value={person.shoeSize} />
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("consentSection")}
              </h2>
              <div className="flex flex-wrap gap-1">
                {person.photoConsent ? (
                  <Badge variant="secondary">{t("photoConsentLabel")}</Badge>
                ) : (
                  "—"
                )}
              </div>
            </div>

            {person.notes ? (
              <div className="flex flex-col gap-3 sm:col-span-2">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("notesLabel")}
                </h2>
                <p className="text-sm whitespace-pre-wrap">{person.notes}</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="familia" keepMounted>
          <Suspense fallback={<FamilySectionSkeleton />}>
            <FamilySection
              personId={person.id}
              guardianId={person.guardianId}
              guardian={person.guardian}
              dependents={person.dependents}
              minorWithoutGuardian={isMinorWithoutGuardian}
              minorGuardian={hasMinorGuardian}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="equipos" keepMounted className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("teamsSection")}
            </h2>
            {canManage && availableTeamOptions.length > 0 ? (
              <span className="print:hidden">
                <MembershipDialog
                  mode="create-person"
                  personId={person.id}
                  personName={fullName}
                  availableTeams={availableTeamOptions}
                />
              </span>
            ) : null}
          </div>
          {seasonGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTeamsDescription")}</p>
          ) : (
            seasonGroups.map(({ season, items }) => (
              <div key={season.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{season.name}</h3>
                  {season.isCurrent ? (
                    <Badge>{tEquipos("currentBadge")}</Badge>
                  ) : null}
                </div>
                <MembershipTable
                  items={items}
                  canManage={canManage}
                  t={tEquipos}
                  subjectHeader={t("colTeam")}
                  nameFor={() => fullName}
                  renderSubject={(m) => (
                    <span className="flex items-center gap-2">
                      <Link href={`/equipos/${m.team.id}`} className="hover:underline">
                        {m.team.name}
                      </Link>
                      {m.isCaptain ? (
                        <Badge variant="outline" title={tEquipos("captainLabel")}>
                          {tEquipos("captainShort")}
                        </Badge>
                      ) : null}
                    </span>
                  )}
                />
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="titulaciones" keepMounted className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("qualificationsSection")}
            </h2>
            {canManage ? (
              <span className="print:hidden">
                <QualificationDialog mode="create" personId={person.id} />
              </span>
            ) : null}
          </div>
          {person.qualifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noQualificationsDescription")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("qualificationTitleLabel")}</TableHead>
                  <TableHead>{t("qualificationIssuerLabel")}</TableHead>
                  <TableHead>{t("qualificationExpiresOnLabel")}</TableHead>
                  <TableHead>{t("qualificationViewFile")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right print:hidden">
                      {t("colActions")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {person.qualifications.map((q) => {
                  const isExpired = q.expiresOn ? q.expiresOn < today : false;
                  const fileUrl = qualificationFileUrls.get(q.id) ?? null;
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.title}</TableCell>
                      <TableCell>{q.issuer ?? "—"}</TableCell>
                      <TableCell>
                        {q.expiresOn ? (
                          <Badge variant={isExpired ? "destructive" : "secondary"}>
                            {isExpired
                              ? t("qualificationExpiredBadge", { date: q.expiresOn })
                              : t("qualificationExpiresBadge", { date: q.expiresOn })}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {t("qualificationViewFile")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {canManage ? (
                        <TableCell className="flex justify-end gap-1 print:hidden">
                          <QualificationDialog
                            mode="edit"
                            qualification={{
                              id: q.id,
                              title: q.title,
                              issuer: q.issuer,
                              issuedOn: q.issuedOn,
                              expiresOn: q.expiresOn,
                              notes: q.notes,
                            }}
                            fileUrl={fileUrl}
                          />
                          <DeleteQualificationDialog id={q.id} title={q.title} />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="documentos" keepMounted className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("documentsSection")}
            </h2>
            {canManage ? (
              <span className="print:hidden">
                <DocumentDialog
                  mode="create"
                  parentId={person.id}
                  formKey="personId"
                  namespace="Personas"
                  htmlIdPrefix="person-document"
                  addAction={addPersonDocument}
                  updateAction={updatePersonDocument}
                />
              </span>
            ) : null}
          </div>
          {person.documents.length === 0 ? (
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
                    <TableHead className="text-right print:hidden">
                      {t("colActions")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {person.documents.map((d) => {
                  const fileUrl = documentFileUrls.get(d.id) ?? null;
                  const typeLabel = fileTypeLabel(d.fileName ?? d.filePath);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell>
                        {typeLabel ? (
                          <Badge variant="outline">{typeLabel}</Badge>
                        ) : (
                          "—"
                        )}
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
                        <TableCell className="flex justify-end gap-1 print:hidden">
                          <DocumentDialog
                            mode="edit"
                            namespace="Personas"
                            htmlIdPrefix="person-document"
                            addAction={addPersonDocument}
                            updateAction={updatePersonDocument}
                            document={{ id: d.id, label: d.label, notes: d.notes }}
                            fileUrl={fileUrl}
                          />
                          <DeleteDocumentDialog
                            id={d.id}
                            label={d.label}
                            namespace="Personas"
                            deleteAction={deletePersonDocument}
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
            parentId={person.id}
            formKey="personId"
            namespace="Personas"
            addAction={addPersonNote}
            deleteAction={deletePersonNote}
            notes={person.noteEntries.map((n) => ({
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
