import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { registrations, teams } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { findCandidates } from "@/lib/person-matching";
import { teamSeasonLabel } from "@/lib/team-label";
import { getSignedUrl, getSignedUrls } from "@/lib/supabase/storage";
import { Link } from "@/i18n/navigation";
import { ReviewForm, type RegistrationDetail } from "@/components/inscripciones/review-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PHOTO_BUCKET = "registration-documents";
const PERSON_PHOTO_BUCKET = "person-photos";
const PERSON_DOCUMENTS_BUCKET = "person-documents";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "secondary",
  rejected: "destructive",
} as const;

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; registrationId: string }>;
}) {
  const { locale, registrationId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Inscripciones");

  const registration = await db.query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: {
      guardians: { orderBy: (g, { asc }) => [asc(g.sortOrder)] },
      reviewer: { columns: { email: true } },
    },
  });
  if (!registration) notFound();

  const [allPersons, seasonTeams, photoUrl, idFrontUrl, idBackUrl] = await Promise.all([
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
    getSignedUrl(PHOTO_BUCKET, registration.photoPath),
    getSignedUrl(PHOTO_BUCKET, registration.idFrontPath),
    getSignedUrl(PHOTO_BUCKET, registration.idBackPath),
  ]);

  // Solo la persona principal tiene foto/DNI nuevos que comparar (los tutores
  // no llevan ficheros en el formulario), así que solo firmamos sus propias
  // coincidencias — un conjunto pequeño, no toda la tabla de personas.
  const mainCandidates = findCandidates(registration, allPersons);
  const [candidatePhotoUrls, candidateIdFrontUrls, candidateIdBackUrls] = await Promise.all([
    getSignedUrls(PERSON_PHOTO_BUCKET, mainCandidates, (p) => p.photoPath, (p) => p.id),
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
    phone: registration.phone,
    email: registration.email,
    iban: registration.iban,
    shirtSize: registration.shirtSize,
    pantsSize: registration.pantsSize,
    shoeSize: registration.shoeSize,
    installmentsChosen: registration.installmentsChosen,
    sepaConsent: registration.sepaConsent,
    termsConsent: registration.termsConsent,
    imageConsent: registration.imageConsent,
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
      phone: g.phone,
      email: g.email,
      candidates: findCandidates(g, allPersons),
    })),
  };

  const teamOptions = seasonTeams.map((team) => ({
    id: team.id,
    label: teamSeasonLabel(team, team.season),
  }));

  const fullName = `${registration.firstName} ${registration.lastName}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/inscripciones" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToList")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t(`kind.${registration.kind}`)}</Badge>
            <Badge variant={STATUS_VARIANT[registration.status]}>
              {t(`status.${registration.status}`)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t("submittedOn", { date: registration.createdAt.toISOString().slice(0, 10) })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("documentsSection")}
        </h2>
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
        <ReviewForm registration={detail} teamOptions={teamOptions} />
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
          {registration.reviewer ? (
            <p>
              {t("reviewedBy", {
                email: registration.reviewer.email,
                date: registration.reviewedAt?.toISOString().slice(0, 10) ?? "",
              })}
            </p>
          ) : null}
          {registration.status === "rejected" && registration.rejectionReason ? (
            <p className="text-muted-foreground">
              {t("rejectionReasonLabel")}: {registration.rejectionReason}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
