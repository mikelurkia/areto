import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { registrations } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format-date";
import { findCandidates } from "@/lib/person-matching";
import { STATUS_VARIANT } from "@/lib/registration-status";
import { Link } from "@/i18n/navigation";
import {
  MemberReviewForm,
  type MemberRegistrationDetail,
} from "@/components/inscripciones/member-review-form";
import { ReviewedRegistrationPanel } from "@/components/inscripciones/reviewed-registration-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SocioRegistrationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; registrationId: string }>;
}) {
  const { locale, registrationId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("socios.view");
  const t = await getTranslations("Inscripciones");

  const registration = await db.query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: {
      reviewer: { columns: { email: true, fullName: true } },
      guardians: { orderBy: (g, { asc }) => [asc(g.sortOrder)] },
      matchedPerson: { columns: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!registration) notFound();
  // Esta pantalla es solo de altas de socio; las de equipo se validan en
  // /inscripciones, con su propio formulario (tallas, tutores, equipo...).
  if (registration.kind !== "member") redirect(`/${locale}/inscripciones/${registrationId}`);

  const allPersons = await db.query.persons.findMany({
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
    },
  });
  const candidates = findCandidates(registration, allPersons);

  const detail: MemberRegistrationDetail = {
    id: registration.id,
    kind: "member",
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
    sepaConsent: registration.sepaConsent,
    privacyConsent: registration.privacyConsent,
    candidates,
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

  const fullName = `${registration.firstName} ${registration.lastName}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/socios" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToList")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t("kind.member")}</Badge>
            <Badge variant={STATUS_VARIANT[registration.status]}>
              {t(`status.${registration.status}`)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t("submittedOn", { date: formatDateTime(registration.createdAt, locale) })}
            </span>
          </div>
        </div>
      </div>

      {registration.status === "pending" ? (
        <MemberReviewForm registration={detail} />
      ) : (
        <ReviewedRegistrationPanel
          registrationId={registration.id}
          kind="member"
          status={registration.status}
          reviewer={registration.reviewer}
          reviewedAt={registration.reviewedAt}
          rejectionReason={registration.rejectionReason}
          phone={registration.phone}
          email={registration.email}
          fullName={fullName}
          locale={locale}
          matchedPerson={registration.matchedPerson}
          backHref={`/socios/${registrationId}`}
        />
      )}
    </div>
  );
}
