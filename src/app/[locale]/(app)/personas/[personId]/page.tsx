import { StatusBadge } from "@/components/status-badge";
import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ClipboardListIcon,
  CreditCardIcon,
  DownloadIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { eq, inArray, or } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { personGuardians, personTags, persons, sepaCharges } from "@/db/schema";
import {
  addPersonDocument,
  addPersonNote,
  deletePersonDocument,
  deletePersonNote,
  updatePersonDocument,
} from "@/app/[locale]/(app)/personas/actions";
import { hasPermission, requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import { calculateAge, isMinor } from "@/lib/age";
import { getBankName } from "@/lib/bank";
import { fileTypeLabel } from "@/lib/file-type";
import { formatDateTime } from "@/lib/format-date";
import { personPhotoDownloadName, personPhotoThumbPath } from "@/lib/person-photo";
import { STATUS_TONE } from "@/lib/registration-status";
import { getSignedUrl, getSignedUrls } from "@/lib/supabase/storage";
import { teamSeasonLabel } from "@/lib/team-label";
import { Link } from "@/i18n/navigation";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipTable } from "@/components/equipos/membership-table";
import { MaskedIbanText } from "@/components/masked-iban";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { AssignMemberNumberButton } from "@/components/personas/assign-member-number-button";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { DeleteInjuryReportDialog } from "@/components/personas/delete-injury-report-dialog";
import { DeleteMedicalCheckupDialog } from "@/components/personas/delete-medical-checkup-dialog";
import { DeleteQualificationDialog } from "@/components/personas/delete-qualification-dialog";
import { DocumentDialog } from "@/components/document-dialog";
import { EntityFileTable } from "@/components/entity-file-table";
import { FamilyPanel, type FamilyMember } from "@/components/personas/family-panel";
import { InfoRow } from "@/components/info-row";
import { MedicalCheckupDialog } from "@/components/personas/medical-checkup-dialog";
import { PersonDialog } from "@/components/personas/person-dialog";
import { PersonCuotasTable } from "@/components/personas/person-cuotas-table";
import { PersonIdScanDialog } from "@/components/personas/person-id-scan-dialog";
import { PersonPhotoDialog } from "@/components/personas/person-photo-dialog";
import { RevokeMandateDialog } from "@/components/personas/revoke-mandate-dialog";
import { NotesLog } from "@/components/notes-log";
import { PersonTagsEditor } from "@/components/personas/person-tags-editor";
import { QualificationDialog } from "@/components/personas/qualification-dialog";
import { PrintButton } from "@/components/print-button";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
const MEDICAL_CHECKUPS_BUCKET = "person-medical-checkups";
const INJURY_REPORTS_BUCKET = "person-injury-reports";
const FEDERATION_CARD_BUCKET = "membership-documents";

// Titulaciones, reconocimientos médicos, partes de lesión y DNI escaneado
// (actions.ts) admiten hasta 10MB, el doble que el resto de subidas del
// repo — con el timeout por defecto de Vercel una conexión lenta puede no
// dar tiempo a terminar.
export const maxDuration = 60;

/**
 * Ficha completa de la persona. En `cache()` para que `generateMetadata` y la
 * página compartan una única consulta por petición, en vez de lanzar dos.
 */
const getPerson = cache((personId: string) =>
  db.query.persons.findFirst({
    where: eq(persons.id, personId),
    with: {
      guardianRows: {
        with: { guardian: true },
        orderBy: (g, { desc }) => [desc(g.isPrimary)],
      },
      guardianOfRows: { with: { person: { columns: FAMILY_PERSON_COLUMNS } } },
      payerPerson: true,
      clubMember: true,
      memberships: { with: { team: { with: { season: true } } } },
      qualifications: { orderBy: (q, { desc }) => [desc(q.createdAt)] },
      medicalCheckups: { orderBy: (m, { desc }) => [desc(m.occurredOn)] },
      injuryReports: { orderBy: (r, { desc }) => [desc(r.occurredOn)] },
      documents: { orderBy: (d, { desc }) => [desc(d.createdAt)] },
      noteEntries: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
      tags: { orderBy: (tag, { asc }) => [asc(tag.tag)] },
      registrations: {
        columns: { id: true, kind: true, status: true, createdAt: true },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      },
    },
  }),
);

/** Persona vista desde el panel de familia: solo lo que pinta una ficha breve. */
/** Las columnas que pinta el panel de familia, y solo esas. */
const FAMILY_PERSON_COLUMNS = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  birthDate: true,
  photoPath: true,
} as const;

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
  personName,
  guardians,
  dependents,
  minorWithoutGuardian,
  minorGuardian,
}: {
  personId: string;
  personName: string;
  guardians: FamilyPerson[];
  dependents: FamilyPerson[];
  minorWithoutGuardian: boolean;
  minorGuardian: boolean;
}) {
  // Hermanos/as = otras personas que comparten al menos uno de estos tutores (no se guarda).
  const guardianIds = guardians.map((g) => g.id);
  const siblingRows =
    guardianIds.length > 0
      ? await db.query.personGuardians.findMany({
          where: inArray(personGuardians.guardianId, guardianIds),
          with: { person: { columns: FAMILY_PERSON_COLUMNS } },
        })
      : [];
  const siblingsById = new Map<string, FamilyPerson>();
  for (const row of siblingRows) {
    if (row.personId === personId) continue;
    siblingsById.set(row.personId, row.person);
  }
  const siblings = [...siblingsById.values()].sort((a, b) =>
    (a.birthDate ?? "").localeCompare(b.birthDate ?? ""),
  );

  // Fotos de todos los familiares, en una sola tanda. Solo miniatura: aquí
  // solo se identifica a cada familiar, el original se ve desde su propia ficha.
  const familyPhotoUrls = await getSignedUrls(
    PHOTO_BUCKET,
    [...guardians, ...siblings, ...dependents],
    (p) => (p.photoPath ? personPhotoThumbPath(p.photoPath) : null),
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
      guardians={guardians.map(toFamilyMember)}
      siblings={siblings.map(toFamilyMember)}
      dependents={dependents.map(toFamilyMember)}
      minorWithoutGuardian={minorWithoutGuardian}
      minorGuardian={minorGuardian}
      backTo={`/personas/${personId}`}
      backLabel={personName}
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
          <Card size="sm" className="flex-row items-center gap-3 px-(--card-spacing)">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

/**
 * Cargos SEPA de la persona: como pagadora (`payerPersonId`) y/o como sujeto
 * cobrado (sus membresías de jugador o su ficha de socio). Aparte del resto
 * de la ficha, con su propio <Suspense>, porque trae relaciones anidadas
 * (remesa, historial de devoluciones) además de los cargos en sí.
 */
async function CuotasSection({
  personId,
  membershipIds,
  clubMemberId,
  locale,
  t,
}: {
  personId: string;
  membershipIds: string[];
  clubMemberId: string | null;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"Cuotas">>>;
}) {
  const conditions = [eq(sepaCharges.payerPersonId, personId)];
  if (membershipIds.length > 0) conditions.push(inArray(sepaCharges.membershipId, membershipIds));
  if (clubMemberId) conditions.push(eq(sepaCharges.clubMemberId, clubMemberId));

  const charges = await db.query.sepaCharges.findMany({
    where: or(...conditions),
    with: {
      remittance: { columns: { id: true, messageId: true } },
      membership: { with: { team: true } },
      returns: {
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        with: { remittance: { columns: { id: true, messageId: true } } },
      },
    },
    orderBy: (charge, { desc }) => [desc(charge.createdAt)],
  });

  const rows = charges.map((charge) => ({
    id: charge.id,
    periodKey: charge.periodKey,
    subjectName: charge.kind === "player" ? (charge.membership?.team?.name ?? "—") : t("kindMember"),
    amountCents: charge.amountCents,
    status: charge.status,
    collectedOn: charge.collectedOn,
    returnedOn: charge.returnedOn,
    returnReason: charge.returnReason,
    remittance: charge.remittance,
    returns: charge.returns,
  }));

  return <PersonCuotasTable charges={rows} locale={locale} />;
}

function CuotasSectionSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-24 w-full" />
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

const PERSON_TABS = [
  "general",
  "familia",
  "equipos",
  "cuotas",
  "titulaciones",
  "medico",
  "documentos",
  "inscripciones",
  "bitacora",
] as const;

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; personId: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string; tab?: string }>;
}) {
  const { locale, personId } = await params;
  const { from, fromLabel, tab } = await searchParams;
  const backHref = resolveBackHref(from, "/personas");
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("personas.view");
  const canManage = hasPermission(user, "personas.manage");
  const canViewMedical = hasPermission(user, "personas.medical.view");
  const canManageMedical = hasPermission(user, "personas.medical.manage");
  const canViewBanking = hasPermission(user, "personas.banking.view");
  const canManageBanking = hasPermission(user, "personas.banking.manage");
  const canViewCuotas = hasPermission(user, "cuotas.view");
  const requestedTab = PERSON_TABS.find((value) => value === tab) ?? "general";
  const initialTab =
    (requestedTab === "medico" && !canViewMedical) ||
    (requestedTab === "cuotas" && !canViewCuotas)
      ? "general"
      : requestedTab;
  const t = await getTranslations("Personas");
  const tCuotas = await getTranslations("Cuotas");
  const tEquipos = await getTranslations("Equipos");
  const tInscripciones = await getTranslations("Inscripciones");

  // `getPerson` va aparte del resto: es, con diferencia, la consulta más
  // pesada de toda la app (una docena de relaciones, varias anidadas dos
  // niveles), y sumarla al mismo `Promise.all` que consultas triviales es el
  // patrón de concurrencia que ya coló el dashboard (ver `src/db/index.ts`).
  const person = await getPerson(personId);
  if (!person) notFound();

  // Mandato SEPA de la persona pagadora efectiva (el tutor si lo hay): el más
  // reciente, sea cual sea su estado, para que un mandato revocado siga visible.
  const effectivePayerId = person.payerPerson?.id ?? person.id;
  const mandate = canViewBanking
    ? await db.query.sepaMandates.findFirst({
        where: (sepaMandates, { eq }) => eq(sepaMandates.payerPersonId, effectivePayerId),
        orderBy: (sepaMandates, { desc }) => [desc(sepaMandates.createdAt)],
      })
    : null;

  // Segunda tanda: todo lo que no depende de la propia ficha. Los equipos se
  // traen completos y se filtran en memoria (son pocas filas), así esta consulta
  // deja de esperar a que lleguen las membresías de la persona. Ya no se trae
  // la lista de personas del club: el selector de tutores los busca al escribir
  // (`GuardianPicker`), así que ver una ficha ya no descarga el listado entero.
  const [existingTagRows, allTeams] = await Promise.all([
    db.selectDistinct({ tag: personTags.tag }).from(personTags).orderBy(personTags.tag),
    db.query.teams.findMany({
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
  ]);

  const existingTags = existingTagRows.map((r) => r.tag);

  const memberTeamIds = new Set(person.memberships.map((m) => m.teamId));
  const availableTeamOptions = allTeams
    .filter((team) => !memberTeamIds.has(team.id))
    .map((team) => ({
      id: team.id,
      label: teamSeasonLabel(team, team.season),
    }));

  // Segunda tanda: las URLs de Storage que necesita la ficha ya cargada. Lo de
  // la familia va por su cuenta, en <FamilySection>.
  const [
    photoThumbUrl,
    idFrontUrl,
    idBackUrl,
    qualificationFileUrls,
    documentFileUrls,
    medicalCheckupFileUrls,
    injuryReportFileUrls,
    federationCardUrls,
  ] = await Promise.all([
    // Avatar de cabecera: solo miniatura. El original (para descargar y usar
    // en trámites federativos) se pide aparte, más abajo.
    getSignedUrl(PHOTO_BUCKET, person.photoPath ? personPhotoThumbPath(person.photoPath) : null),
    getSignedUrl(DOCUMENTS_BUCKET, person.idFrontPath),
    getSignedUrl(DOCUMENTS_BUCKET, person.idBackPath),
    getSignedUrls(QUALIFICATIONS_BUCKET, person.qualifications, (q) => q.filePath, (q) => q.id),
    getSignedUrls(DOCUMENTS_BUCKET, person.documents, (d) => d.filePath, (d) => d.id),
    getSignedUrls(MEDICAL_CHECKUPS_BUCKET, person.medicalCheckups, (m) => m.filePath, (m) => m.id),
    getSignedUrls(INJURY_REPORTS_BUCKET, person.injuryReports, (r) => r.filePath, (r) => r.id),
    getSignedUrls(
      FEDERATION_CARD_BUCKET,
      person.memberships,
      (m) => m.federationCardPath,
      (m) => m.id,
    ),
  ]);
  // Foto a tamaño completo: solo se pide para el enlace de "ver/descargar
  // original" (no se muestra inline en ningún sitio).
  const photoUrl = await getSignedUrl(PHOTO_BUCKET, person.photoPath);

  const today = new Date().toISOString().slice(0, 10);
  const fullName = `${person.firstName} ${person.lastName}`;
  const photoDownloadName = person.photoPath
    ? personPhotoDownloadName(fullName, person.photoPath)
    : null;
  const photoDownloadUrl =
    photoUrl && photoDownloadName
      ? `${photoUrl}?filename=${encodeURIComponent(photoDownloadName)}`
      : photoUrl;
  const consentDateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtConsentDate = (d: Date | string | null) => (d ? consentDateFmt.format(new Date(d)) : null);
  const photoConsentDate = fmtConsentDate(person.photoConsentAt);
  const sepaConsentDate = fmtConsentDate(
    person.payerPerson ? person.payerPerson.sepaConsentAt : person.sepaConsentAt,
  );
  const termsConsentDate = fmtConsentDate(person.termsConsentAt);
  const privacyConsentDate = fmtConsentDate(person.privacyConsentAt);
  const isMinorWithoutGuardian = isMinor(person.birthDate) && person.guardianRows.length === 0;
  const hasMinorGuardian = person.guardianRows.some((r) => isMinor(r.guardian.birthDate));
  const birthYear = person.birthDate ? Number(person.birthDate.slice(0, 4)) : null;
  const ageTeamNames = birthYear
    ? allTeams
        .filter(
          (team) =>
            team.season.isCurrent &&
            team.minBirthYear != null &&
            team.maxBirthYear != null &&
            birthYear >= team.minBirthYear &&
            birthYear <= team.maxBirthYear,
        )
        .map((team) => team.name)
        .join(", ") || null
    : null;
  const isMember = person.clubMember?.status === "active";
  const memberNumber = person.clubMember?.memberNumber ?? null;

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

  const backLabel =
    fromLabel && backHref !== "/personas"
      ? t("backToPersonasFrom", { name: fromLabel })
      : t("backToPersonas");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        title={fullName}
        media={
          <div className="relative">
            {photoUrl ? (
              <a
                href={photoDownloadUrl!}
                target="_blank"
                rel="noreferrer"
                aria-label={t("viewOriginalPhotoAction")}
                title={t("viewOriginalPhotoAction")}
              >
                <Avatar size="lg">
                  {photoThumbUrl ? <AvatarImage src={photoThumbUrl} alt="" /> : null}
                  <AvatarFallback>
                    <UserRoundIcon className="size-5" />
                  </AvatarFallback>
                </Avatar>
              </a>
            ) : (
              <Avatar size="lg">
                <AvatarFallback>
                  <UserRoundIcon className="size-5" />
                </AvatarFallback>
              </Avatar>
            )}
            {canManage ? (
              <span className="absolute -bottom-1 -right-1 print:hidden">
                <PersonPhotoDialog personId={person.id} photoUrl={photoThumbUrl} />
              </span>
            ) : null}
          </div>
        }
        meta={
          <>
            {isMember ? (
              <Badge variant="secondary">{t("memberBadge")}</Badge>
            ) : null}
            {[...new Set(person.memberships.map((m) => m.role))].map((role) => (
              <Badge key={role} variant="secondary">
                {tEquipos(`roleOption.${role}`)}
              </Badge>
            ))}
            {person.guardianOfRows.length > 0 ? (
              <Badge variant="secondary">
                {t("guardianOfBadge", { count: person.guardianOfRows.length })}
              </Badge>
            ) : null}
            {isMinor(person.birthDate) ? (
              <Badge variant="outline">{t("minorTag")}</Badge>
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
            <PersonTagsEditor
              personId={person.id}
              tags={person.tags}
              existingTags={existingTags}
              canManage={canManage}
            />
          </>
        }
        actions={
          <>
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
            {photoUrl ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={photoDownloadUrl!} download={photoDownloadName ?? undefined} />}
                nativeButton={false}
              >
                <DownloadIcon data-icon="inline-start" />
                {t("downloadOriginalPhotoAction")}
              </Button>
            ) : null}
            <PrintButton label={t("printAction")} />
            {canManage ? (
              <PersonDialog
                mode="edit"
                person={{
                  ...person,
                  // Sin `personas.banking.view`, no viaja al cliente: de otro
                  // modo el diálogo lo serializaría igual sin permiso.
                  iban: canViewBanking ? person.iban : null,
                  isMember,
                  memberNumber,
                  guardians: person.guardianRows.map((r) => ({
                    id: r.guardian.id,
                    firstName: r.guardian.firstName,
                    lastName: r.guardian.lastName,
                  })),
                }}
                photoUrl={photoThumbUrl}
                canManageBanking={canManageBanking}
              />
            ) : null}
          </>
        }
      />

      {/* `key` fuerza a remontar si `initialTab` cambia entre navegaciones a esta
          misma ruta (p. ej. "Volver a la ficha" desde el parte de lesión con
          `?tab=medico`): al ser React el mismo componente de página, reutilizaría
          el `<Tabs>` ya montado y Base UI avisa de que un no controlado no debe
          cambiar su `defaultValue` tras inicializarse. */}
      <Tabs key={initialTab} defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="general">{t("tabGeneral")}</TabsTrigger>
          <TabsTrigger value="familia">{t("tabFamily")}</TabsTrigger>
          <TabsTrigger value="equipos">
            {t("tabTeams", { count: person.memberships.length })}
          </TabsTrigger>
          {canViewCuotas ? (
            <TabsTrigger value="cuotas">{t("tabCuotas")}</TabsTrigger>
          ) : null}
          <TabsTrigger value="titulaciones">
            {t("tabQualifications", { count: person.qualifications.length })}
          </TabsTrigger>
          {canViewMedical ? (
            <TabsTrigger value="medico">
              {t("tabMedical", {
                count: person.medicalCheckups.length + person.injuryReports.length,
              })}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="documentos">
            {t("tabDocuments", { count: person.documents.length })}
          </TabsTrigger>
          <TabsTrigger value="inscripciones">
            {t("tabRegistrations", { count: person.registrations.length })}
          </TabsTrigger>
          <TabsTrigger value="bitacora">
            {t("tabNotesLog", { count: person.noteEntries.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" keepMounted className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionHeading title={t("contactSection")} />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow label={t("emailLabel")} value={person.email} />
                <InfoRow label={t("phoneLabel")} value={person.phone} />
                <InfoRow label={t("addressLabel")} value={person.address} />
                <InfoRow label={t("postalCodeLabel")} value={person.postalCode} />
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
              <SectionHeading title={t("personalDataSection")} />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow
                  label={t("birthDateLabel")}
                  value={
                    person.birthDate ? (
                      <>
                        {person.birthDate}
                        {ageTeamNames ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {t("birthDateAgeTeamHint", { teams: ageTeamNames })}
                          </span>
                        ) : null}
                      </>
                    ) : null
                  }
                />
                <InfoRow label={t("nationalIdLabel")} value={person.nationalId} />
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading title={t("memberSection")} />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow
                  label={t("memberNumberLabel")}
                  value={
                    memberNumber ??
                    (isMember && canManage ? (
                      <span className="print:hidden">
                        <AssignMemberNumberButton personId={person.id} />
                      </span>
                    ) : null)
                  }
                />
                {canViewBanking ? (
                  <InfoRow
                    label={person.payerPerson ? t("paidByLabel") : t("ibanLabel")}
                    value={
                      person.payerPerson ? (
                        <Link
                          href={`/personas/${person.payerPerson.id}`}
                          className="text-primary hover:underline"
                        >
                          {person.payerPerson.firstName} {person.payerPerson.lastName}
                        </Link>
                      ) : person.iban ? (
                        <MaskedIbanText value={person.iban} />
                      ) : null
                    }
                  />
                ) : null}
                {canViewBanking && !person.payerPerson && getBankName(person.iban) ? (
                  <InfoRow label={t("bankLabel")} value={getBankName(person.iban)} />
                ) : null}
                {canViewBanking && mandate ? (
                  <InfoRow
                    label={t("mandateLabel")}
                    value={
                      mandate.status === "active"
                        ? t("mandateActiveValue", { rum: mandate.rum })
                        : t("mandateRevokedValue", { rum: mandate.rum })
                    }
                  />
                ) : null}
                {canManageBanking && mandate?.status === "active" ? (
                  <div className="pt-1">
                    <RevokeMandateDialog payerPersonId={effectivePayerId} />
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading title={t("idDocumentsSection")} />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow
                  label={t("idFrontLabel")}
                  value={
                    <div className="flex items-center gap-2">
                      {idFrontUrl ? (
                        <a
                          href={idFrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t("documentViewFile")}
                        </a>
                      ) : (
                        "—"
                      )}
                      {canManage ? (
                        <span className="print:hidden">
                          <PersonIdScanDialog
                            personId={person.id}
                            side="front"
                            fileUrl={idFrontUrl}
                          />
                        </span>
                      ) : null}
                    </div>
                  }
                />
                <InfoRow
                  label={t("idBackLabel")}
                  value={
                    <div className="flex items-center gap-2">
                      {idBackUrl ? (
                        <a
                          href={idBackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t("documentViewFile")}
                        </a>
                      ) : (
                        "—"
                      )}
                      {canManage ? (
                        <span className="print:hidden">
                          <PersonIdScanDialog
                            personId={person.id}
                            side="back"
                            fileUrl={idBackUrl}
                          />
                        </span>
                      ) : null}
                    </div>
                  }
                />
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading title={t("sizesSection")} />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <InfoRow label={t("shirtSizeLabel")} value={person.shirtSize} />
                <InfoRow label={t("pantsSizeLabel")} value={person.pantsSize} />
                <InfoRow label={t("shoeSizeLabel")} value={person.shoeSize} />
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeading title={t("consentSection")} />
              <div className="flex flex-wrap gap-1">
                {person.photoConsent ? (
                  <Badge
                    variant="secondary"
                    title={
                      photoConsentDate
                        ? t("consentSinceLabel", { date: photoConsentDate })
                        : undefined
                    }
                  >
                    {t("photoConsentLabel")}
                  </Badge>
                ) : null}
                {(person.payerPerson ? person.payerPerson.sepaConsent : person.sepaConsent) ? (
                  <Badge
                    variant="secondary"
                    title={
                      sepaConsentDate ? t("consentSinceLabel", { date: sepaConsentDate }) : undefined
                    }
                  >
                    {t("sepaConsentLabel")}
                  </Badge>
                ) : null}
                {person.termsConsent ? (
                  <Badge
                    variant="secondary"
                    title={
                      termsConsentDate
                        ? t("consentSinceLabel", { date: termsConsentDate })
                        : undefined
                    }
                  >
                    {t("termsConsentLabel")}
                  </Badge>
                ) : null}
                {person.privacyConsent ? (
                  <Badge
                    variant="secondary"
                    title={
                      privacyConsentDate
                        ? t("consentSinceLabel", { date: privacyConsentDate })
                        : undefined
                    }
                  >
                    {t("privacyConsentLabel")}
                  </Badge>
                ) : null}
                {!person.photoConsent &&
                !(person.payerPerson ? person.payerPerson.sepaConsent : person.sepaConsent) &&
                !person.termsConsent &&
                !person.privacyConsent
                  ? "—"
                  : null}
              </div>
            </div>

            {person.notes ? (
              <div className="flex flex-col gap-3 sm:col-span-2">
                <SectionHeading title={t("notesLabel")} />
                <p className="text-sm whitespace-pre-wrap">{person.notes}</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="familia" keepMounted>
          <Suspense fallback={<FamilySectionSkeleton />}>
            <FamilySection
              personId={person.id}
              personName={fullName}
              guardians={person.guardianRows.map((r) => r.guardian)}
              dependents={person.guardianOfRows.map((r) => r.person)}
              minorWithoutGuardian={isMinorWithoutGuardian}
              minorGuardian={hasMinorGuardian}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="equipos" keepMounted className="flex flex-col gap-4">
          <SectionHeading
            title={t("teamsSection")}
            actions={
              canManage && availableTeamOptions.length > 0 ? (
                <MembershipDialog
                  mode="create-person"
                  personId={person.id}
                  personName={fullName}
                  availableTeams={availableTeamOptions}
                />
              ) : null
            }
          />
          {seasonGroups.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noTeamsDescription")} />
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
                  items={items.map((m) => ({
                    ...m,
                    federationCardUrl: federationCardUrls.get(m.id) ?? null,
                    installmentsMode: m.team.playerFeePeriod === "installments",
                  }))}
                  canManage={canManage}
                  t={tEquipos}
                  subjectHeader={t("colTeam")}
                  nameFor={() => fullName}
                  renderSubject={(m) => (
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/equipos/${m.team.id}?from=${encodeURIComponent(`/personas/${person.id}`)}&fromLabel=${encodeURIComponent(fullName)}`}
                        className="hover:underline"
                      >
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

        {canViewCuotas ? (
          <TabsContent value="cuotas" keepMounted className="flex flex-col gap-4">
            <SectionHeading title={t("cuotasSection")} />
            <Suspense fallback={<CuotasSectionSkeleton />}>
              <CuotasSection
                personId={person.id}
                membershipIds={person.memberships.map((m) => m.id)}
                clubMemberId={person.clubMember?.id ?? null}
                locale={locale}
                t={tCuotas}
              />
            </Suspense>
          </TabsContent>
        ) : null}

        <TabsContent value="titulaciones" keepMounted className="flex flex-col gap-4">
          <SectionHeading
            title={t("qualificationsSection")}
            actions={
              canManage ? (
                <QualificationDialog mode="create" personId={person.id} />
              ) : null
            }
          />
          {person.qualifications.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noQualificationsDescription")} />
          ) : (
            <EntityFileTable
              items={person.qualifications}
              canManage={canManage}
              actionsLabel={t("colActions")}
              viewFileLabel={t("qualificationViewFile")}
              fileUrl={(q) => qualificationFileUrls.get(q.id) ?? null}
              columns={[
                { header: t("qualificationTitleLabel"), cell: (q) => q.title, className: "font-medium" },
                {
                  header: t("qualificationIssuerLabel"),
                  cell: (q) => q.issuer ?? "—",
                  priority: "tertiary",
                },
                {
                  header: t("qualificationExpiresOnLabel"),
                  priority: "secondary",
                  cell: (q) => {
                    if (!q.expiresOn) return "—";
                    const isExpired = q.expiresOn < today;
                    return (
                      <Badge variant={isExpired ? "destructive" : "secondary"}>
                        {isExpired
                          ? t("qualificationExpiredBadge", { date: q.expiresOn })
                          : t("qualificationExpiresBadge", { date: q.expiresOn })}
                      </Badge>
                    );
                  },
                },
              ]}
              renderActions={(q) => (
                <>
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
                    fileUrl={qualificationFileUrls.get(q.id) ?? null}
                  />
                  <DeleteQualificationDialog id={q.id} title={q.title} />
                </>
              )}
            />
          )}
        </TabsContent>

        {canViewMedical ? (
          <TabsContent value="medico" keepMounted className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <SectionHeading
              title={t("medicalCheckupsSection")}
              actions={
                canManageMedical ? (
                  <MedicalCheckupDialog mode="create" personId={person.id} />
                ) : null
              }
            />
            {person.medicalCheckups.length === 0 ? (
              <SectionPlaceholder size="compact" title={t("noMedicalCheckupsDescription")} />
            ) : (
              <>
                {(() => {
                  const latest = person.medicalCheckups[0];
                  const isExpired = latest.expiresOn ? latest.expiresOn < today : false;
                  return latest.expiresOn ? (
                    <Badge
                      variant={isExpired ? "destructive" : "secondary"}
                      className="w-fit"
                    >
                      {isExpired
                        ? t("medicalCheckupExpiredBadge", { date: latest.expiresOn })
                        : t("medicalCheckupExpiresBadge", { date: latest.expiresOn })}
                    </Badge>
                  ) : null;
                })()}
                <EntityFileTable
                  items={person.medicalCheckups}
                  canManage={canManageMedical}
                  actionsLabel={t("colActions")}
                  viewFileLabel={t("medicalCheckupViewFile")}
                  fileUrl={(m) => medicalCheckupFileUrls.get(m.id) ?? null}
                  columns={[
                    {
                      header: t("medicalCheckupOccurredOnLabel"),
                      cell: (m) => m.occurredOn,
                      className: "font-medium",
                    },
                    {
                      header: t("medicalCheckupIssuerLabel"),
                      cell: (m) => m.issuer ?? "—",
                      priority: "tertiary",
                    },
                    {
                      header: t("medicalCheckupExpiresOnLabel"),
                      priority: "secondary",
                      cell: (m) => {
                        if (!m.expiresOn) return "—";
                        const isExpired = m.expiresOn < today;
                        return (
                          <Badge variant={isExpired ? "destructive" : "secondary"}>
                            {isExpired
                              ? t("medicalCheckupExpiredBadge", { date: m.expiresOn })
                              : t("medicalCheckupExpiresBadge", { date: m.expiresOn })}
                          </Badge>
                        );
                      },
                    },
                  ]}
                  renderActions={(m) => (
                    <>
                      <MedicalCheckupDialog
                        mode="edit"
                        checkup={{
                          id: m.id,
                          occurredOn: m.occurredOn,
                          expiresOn: m.expiresOn,
                          issuer: m.issuer,
                          notes: m.notes,
                        }}
                        fileUrl={medicalCheckupFileUrls.get(m.id) ?? null}
                      />
                      <DeleteMedicalCheckupDialog id={m.id} date={m.occurredOn} />
                    </>
                  )}
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <SectionHeading
              title={t("injuryReportsSection")}
              actions={
                canManageMedical ? (
                  /* Sin ficha en ningún equipo no hay parte que tramitar: lo
                     cubre la licencia federativa del jugador con su equipo
                     (ver la página del parte, que rechaza el alta igual). */
                  person.memberships.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("injuryReportNoTeamHint")}
                    </p>
                  ) : (
                    <Button
                      render={<Link href={`/personas/${person.id}/parte-lesion/nuevo`} />}
                      nativeButton={false}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {t("addInjuryReportAction")}
                    </Button>
                  )
                ) : null
              }
            />
            {person.injuryReports.length === 0 ? (
              <SectionPlaceholder size="compact" title={t("noInjuryReportsDescription")} />
            ) : (
              <EntityFileTable
                items={person.injuryReports}
                canManage={canManageMedical}
                actionsLabel={t("colActions")}
                viewFileLabel={t("injuryReportViewFile")}
                fileUrl={(r) => injuryReportFileUrls.get(r.id) ?? null}
                columns={[
                  {
                    header: t("injuryReportOccurredOnLabel"),
                    cell: (r) => r.occurredOn,
                    className: "font-medium",
                  },
                ]}
                renderActions={(r) => (
                  <>
                    {canManageMedical ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/personas/${person.id}/parte-lesion/${r.id}`} />}
                        nativeButton={false}
                      >
                        <ClipboardListIcon />
                        <span className="sr-only">
                          {t("injuryReportFederationSr", { date: r.occurredOn })}
                        </span>
                      </Button>
                    ) : null}
                    <DeleteInjuryReportDialog id={r.id} date={r.occurredOn} />
                  </>
                )}
              />
            )}
          </div>
          </TabsContent>
        ) : null}

        <TabsContent value="documentos" keepMounted className="flex flex-col gap-4">
          <SectionHeading
            title={t("documentsSection")}
            actions={
              canManage ? (
                <DocumentDialog
                  mode="create"
                  parentId={person.id}
                  formKey="personId"
                  namespace="Personas"
                  htmlIdPrefix="person-document"
                  addAction={addPersonDocument}
                  updateAction={updatePersonDocument}
                />
              ) : null
            }
          />
          {person.documents.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noDocumentsDescription")} />
          ) : (
            <EntityFileTable
              items={person.documents}
              canManage={canManage}
              actionsLabel={t("colActions")}
              viewFileLabel={t("documentViewFile")}
              fileUrl={(d) => documentFileUrls.get(d.id) ?? null}
              columns={[
                { header: t("documentLabelLabel"), cell: (d) => d.label, className: "font-medium" },
                {
                  header: t("documentTypeColumn"),
                  priority: "secondary",
                  cell: (d) => {
                    const typeLabel = fileTypeLabel(d.fileName ?? d.filePath);
                    return typeLabel ? <Badge variant="outline">{typeLabel}</Badge> : "—";
                  },
                },
                {
                  header: t("documentNotesColumn"),
                  cell: (d) => d.notes ?? "—",
                  className: "text-muted-foreground",
                  priority: "tertiary",
                },
              ]}
              renderActions={(d) => (
                <>
                  <DocumentDialog
                    mode="edit"
                    namespace="Personas"
                    htmlIdPrefix="person-document"
                    addAction={addPersonDocument}
                    updateAction={updatePersonDocument}
                    document={{ id: d.id, label: d.label, notes: d.notes }}
                    fileUrl={documentFileUrls.get(d.id) ?? null}
                  />
                  <DeleteDocumentDialog
                    id={d.id}
                    label={d.label}
                    namespace="Personas"
                    deleteAction={deletePersonDocument}
                  />
                </>
              )}
            />
          )}
        </TabsContent>

        <TabsContent value="inscripciones" keepMounted className="flex flex-col gap-4">
          <SectionHeading title={t("registrationsSection")} />
          {person.registrations.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noRegistrationsDescription")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tInscripciones("colKind")}</TableHead>
                  <TableHead>{tInscripciones("colStatus")}</TableHead>
                  <TableHead>{tInscripciones("colDate")}</TableHead>
                  <TableHead className="text-right">{t("viewRegistrationAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {person.registrations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline">{tInscripciones(`kind.${r.kind}` as "kind.player")}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={STATUS_TONE[r.status]}
                        label={tInscripciones(`status.${r.status}` as "status.pending")}
                      />
                    </TableCell>
                    <TableCell nowrap className="text-muted-foreground">
                      {formatDateTime(r.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={r.kind === "player" ? `/inscripciones/${r.id}` : `/socios/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        {t("viewRegistrationAction")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="bitacora" keepMounted className="flex flex-col gap-4">
          <SectionHeading title={t("notesLogSection")} />
          <NotesLog
            parentId={person.id}
            formKey="personId"
            namespace="Personas"
            addAction={addPersonNote}
            deleteAction={deletePersonNote}
            canManage={canManage}
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
