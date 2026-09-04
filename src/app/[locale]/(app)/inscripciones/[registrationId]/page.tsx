import { StatusBadge } from "@/components/status-badge";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { registrations, seasonCategoryBirthYears, teams } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format-date";
import { findCandidates } from "@/lib/person-matching";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { STATUS_TONE } from "@/lib/registration-status";
import { teamSeasonLabel } from "@/lib/team-label";
import { getSignedUrl, getSignedUrls } from "@/lib/supabase/storage";
import { ReviewForm, type RegistrationDetail } from "@/components/inscripciones/review-form";
import { ReviewedRegistrationPanel } from "@/components/inscripciones/reviewed-registration-panel";
import { PlayerRegistrationSummary } from "@/components/inscripciones/registration-summary";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

const PHOTO_BUCKET = "registration-documents";
const PERSON_PHOTO_BUCKET = "person-photos";
const PERSON_DOCUMENTS_BUCKET = "person-documents";

// Al aprobar (ver `approveRegistration` en actions.ts) se copian hasta 3
// ficheros de hasta 5MB entre buckets de Storage (download+upload cada uno,
// en serie) más un resize con sharp — mismo timeout por defecto de Vercel
// que en la inscripción pública.
export const maxDuration = 60;

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; registrationId: string }>;
}) {
  const { locale, registrationId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("inscripciones.view");
  const canManage = hasPermission(user, "inscripciones.manage");
  const t = await getTranslations("Inscripciones");

  const registration = await db.query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: {
      guardians: { orderBy: (g, { asc }) => [asc(g.sortOrder)] },
      reviewer: { columns: { email: true, fullName: true } },
      matchedPerson: { columns: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!registration) notFound();
  // Esta pantalla es solo de inscripciones de equipo; las de socio se validan
  // en /socios, con su propio formulario más corto.
  if (registration.kind !== "player") redirect(`/${locale}/socios/${registrationId}`);

  const [allPersons, seasonTeams, seasonCategoryRanges, photoUrl, idFrontUrl, idBackUrl] = await Promise.all([
    db.query.persons.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        nationalId: true,
        email: true,
        birthDate: true,
        address: true,
        city: true,
        postalCode: true,
        phone: true,
        iban: true,
        shirtSize: true,
        pantsSize: true,
        shoeSize: true,
        photoPath: true,
        idFrontPath: true,
        idBackPath: true,
      },
    }),
    db.query.teams.findMany({
      where: eq(teams.seasonId, registration.seasonId),
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
    db.query.seasonCategoryBirthYears.findMany({
      where: eq(seasonCategoryBirthYears.seasonId, registration.seasonId),
    }),
    // Solo se usa como miniatura de comparación/revisión (64-128px), nunca a
    // tamaño completo, así que basta con la miniatura.
    getSignedUrl(
      PHOTO_BUCKET,
      registration.photoPath ? personPhotoThumbPath(registration.photoPath) : null,
    ),
    getSignedUrl(PHOTO_BUCKET, registration.idFrontPath),
    getSignedUrl(PHOTO_BUCKET, registration.idBackPath),
  ]);

  // Solo la persona principal tiene foto/DNI nuevos que comparar (los tutores
  // no llevan ficheros en el formulario), así que solo resolvemos las URLs de
  // sus propias coincidencias — un conjunto pequeño, no toda la tabla de personas.
  const mainCandidates = findCandidates(registration, allPersons);
  const [candidatePhotoUrls, candidateIdFrontUrls, candidateIdBackUrls] = await Promise.all([
    getSignedUrls(
      PERSON_PHOTO_BUCKET,
      mainCandidates,
      (p) => (p.photoPath ? personPhotoThumbPath(p.photoPath) : null),
      (p) => p.id,
    ),
    getSignedUrls(PERSON_DOCUMENTS_BUCKET, mainCandidates, (p) => p.idFrontPath, (p) => p.id),
    getSignedUrls(PERSON_DOCUMENTS_BUCKET, mainCandidates, (p) => p.idBackPath, (p) => p.id),
  ]);

  const detail: RegistrationDetail = {
    id: registration.id,
    kind: registration.kind,
    status: registration.status,
    firstName: registration.firstName,
    lastName: registration.lastName,
    birthDate: registration.birthDate,
    nationalId: registration.nationalId,
    address: registration.address,
    city: registration.city,
    postalCode: registration.postalCode,
    phone: registration.phone,
    email: registration.email,
    iban: registration.iban,
    shirtSize: registration.shirtSize,
    pantsSize: registration.pantsSize,
    shoeSize: registration.shoeSize,
    installmentsChosen: registration.installmentsChosen,
    sepaConsent: registration.sepaConsent,
    termsConsent: registration.termsConsent,
    photoConsent: registration.photoConsent,
    privacyConsent: registration.privacyConsent,
    newPhotoUrl: photoUrl,
    newIdFrontUrl: idFrontUrl,
    newIdBackUrl: idBackUrl,
    candidates: mainCandidates.map((c) => ({
      ...c,
      photoUrl: candidatePhotoUrls.get(c.id) ?? null,
      idFrontUrl: candidateIdFrontUrls.get(c.id) ?? null,
      idBackUrl: candidateIdBackUrls.get(c.id) ?? null,
    })),
    guardians: registration.guardians.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      birthDate: g.birthDate,
      nationalId: g.nationalId,
      address: g.address,
      city: g.city,
      postalCode: g.postalCode,
      phone: g.phone,
      email: g.email,
      candidates: findCandidates(g, allPersons),
    })),
  };

  const birthYearsByCategory = new Map(
    seasonCategoryRanges.map((row) => [row.category, row]),
  );
  const teamOptions = seasonTeams.map((team) => {
    const range = team.category ? birthYearsByCategory.get(team.category) : undefined;
    return {
      id: team.id,
      label: teamSeasonLabel(team, team.season),
      minBirthYear: range?.minBirthYear ?? null,
      maxBirthYear: range?.maxBirthYear ?? null,
    };
  });

  const fullName = `${registration.firstName} ${registration.lastName}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        back={{ href: "/inscripciones", label: t("backToList") }}
        title={fullName}
        meta={
          <>
            <Badge variant="outline">{t(`kind.${registration.kind}`)}</Badge>
            <StatusBadge
              tone={STATUS_TONE[registration.status]}
              label={t(`status.${registration.status}`)}
            />
            <span className="text-sm text-muted-foreground">
              {t("submittedOn", { date: formatDateTime(registration.createdAt, locale) })}
            </span>
          </>
        }
      />

      <div className="flex flex-col gap-2">
        <SectionHeading title={t("documentsSection")} />
        <div className="flex flex-wrap gap-4">
          {(
            [
              { url: photoUrl, label: t("photoLabel"), className: "h-32 w-32" },
              { url: idFrontUrl, label: t("idFrontLabel"), className: "h-32 w-48" },
              { url: idBackUrl, label: t("idBackLabel"), className: "h-32 w-48" },
            ] as const
          ).map((doc) =>
            doc.url ? (
              <a
                key={doc.label}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={doc.url} alt="" className={`${doc.className} rounded-lg border object-cover`} />
                <span className="text-xs text-muted-foreground">{doc.label}</span>
              </a>
            ) : (
              <div key={doc.label} className="flex flex-col items-center gap-1">
                <div
                  className={`${doc.className} flex items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground`}
                >
                  {t("documentMissing")}
                </div>
                <span className="text-xs text-muted-foreground">{doc.label}</span>
              </div>
            ),
          )}
        </div>
      </div>

      {registration.status === "pending" ? (
        canManage ? (
          <ReviewForm registration={detail} teamOptions={teamOptions} />
        ) : (
          <PlayerRegistrationSummary registration={detail} />
        )
      ) : (
        <ReviewedRegistrationPanel
          registrationId={registration.id}
          kind="player"
          status={registration.status}
          reviewer={registration.reviewer}
          reviewedAt={registration.reviewedAt}
          rejectionReason={registration.rejectionReason}
          phone={registration.phone}
          email={registration.email}
          fullName={fullName}
          locale={locale}
          matchedPerson={registration.matchedPerson}
          backHref={`/inscripciones/${registrationId}`}
          canManage={canManage}
        />
      )}
    </div>
  );
}
