import { cache } from "react";
import { notFound } from "next/navigation";
import { CreditCardIcon, UserRoundIcon } from "lucide-react";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import QRCode from "qrcode";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { persons, seasons } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { getSignedUrl } from "@/lib/supabase/storage";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { AssignMemberNumberButton } from "@/components/personas/assign-member-number-button";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PHOTO_BUCKET = "person-photos";

/** En `cache()`: la piden `generateMetadata` y la página en el mismo render. */
const getPerson = cache((personId: string) =>
  db.query.persons.findFirst({
    where: eq(persons.id, personId),
    with: { clubMember: true },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; personId: string }>;
}) {
  const { personId } = await params;
  const person = await getPerson(personId);
  return {
    title: person ? `Carné · ${person.firstName} ${person.lastName}` : "Areto",
  };
}

export default async function MemberCardPage({
  params,
}: {
  params: Promise<{ locale: string; personId: string }>;
}) {
  const { locale, personId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("personas.view");
  const canManage = hasPermission(user, "personas.manage");
  const t = await getTranslations("Personas");

  const [person, club] = await Promise.all([
    getPerson(personId),
    getClubSettings(),
  ]);
  if (!person) notFound();

  const fullName = `${person.firstName} ${person.lastName}`;
  const isMember = person.clubMember?.status === "active";
  const memberNumber = person.clubMember?.memberNumber ?? null;

  const photoUrl = await getSignedUrl(
    PHOTO_BUCKET,
    person.photoPath ? personPhotoThumbPath(person.photoPath) : null,
  );

  const joinedAt = person.clubMember?.joinedAt ?? null;
  const joinedSeason = joinedAt
    ? await db.query.seasons.findFirst({
        where: and(
          lte(seasons.startsOn, joinedAt),
          or(isNull(seasons.endsOn), gte(seasons.endsOn, joinedAt)),
        ),
        columns: { name: true },
      })
    : null;

  // QR con el nº de socio a secas (pensado para escanearlo en el futuro,
  // p. ej. para registrar asistencia a partidos).
  const qrSvg =
    memberNumber !== null
      ? await QRCode.toString(String(memberNumber), { type: "svg", margin: 0, width: 132 })
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/personas/${person.id}`} label={t("backToPersona")} />
        {memberNumber !== null ? <PrintButton label={t("printAction")} /> : null}
      </div>

      {memberNumber === null ? (
        <SectionPlaceholder
          className="mx-auto max-w-md"
          icon={CreditCardIcon}
          title={isMember ? t("memberCardNoNumber") : t("memberCardNotMember")}
        >
          {isMember && canManage ? <AssignMemberNumberButton personId={person.id} /> : null}
        </SectionPlaceholder>
      ) : (
        /* Al contrario que el resto de documentos, el carné se imprime tal cual
           se ve: `print-color-adjust: exact` para que el navegador no descarte
           el fondo de color de la cabecera, que es parte de la identidad. */
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-sm print:[print-color-adjust:exact]">
          {/* Cabecera del club */}
          <div className="bg-primary px-4 py-2 text-primary-foreground">
            <p className="truncate text-sm font-semibold">{club?.legalName ?? "Areto"}</p>
            <p className="text-xs opacity-80">{t("memberCardTitle")}</p>
          </div>
          <div className="flex items-center gap-4 p-4">
            <Avatar size="lg">
              {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
              <AvatarFallback>
                <UserRoundIcon className="size-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{fullName}</p>
              <p className="text-xs text-muted-foreground">{t("memberNumberLabel")}</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {memberNumber}
              </p>
              {joinedSeason ? (
                <p className="text-xs text-muted-foreground">
                  {t("memberSinceLabel")} {joinedSeason.name}
                </p>
              ) : null}
            </div>
            {qrSvg ? (
              <div
                // El SVG generado trae width/height="132" fijos (resolución de
                // impresión); sin forzar el hijo a size-full queda más grande
                // que el contenedor y se recorta.
                className="size-[72px] shrink-0 [&>svg]:size-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
