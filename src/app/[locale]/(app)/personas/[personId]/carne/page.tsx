import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeftIcon, UserRoundIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";

import { db } from "@/db";
import { persons } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { getSignedUrl } from "@/lib/supabase/storage";
import { Link } from "@/i18n/navigation";
import { AssignMemberNumberButton } from "@/components/personas/assign-member-number-button";
import { PrintButton } from "@/components/print-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const PHOTO_BUCKET = "person-photos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const person = await db.query.persons.findFirst({ where: eq(persons.id, personId) });
  return {
    title: person ? `Carné · ${person.firstName} ${person.lastName}` : "Areto",
  };
}

export default async function MemberCardPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Personas");
  const locale = await getLocale();

  const [person, club] = await Promise.all([
    db.query.persons.findFirst({ where: eq(persons.id, personId) }),
    getClubSettings(),
  ]);
  if (!person) notFound();

  const fullName = `${person.firstName} ${person.lastName}`;

  const photoUrl = await getSignedUrl(PHOTO_BUCKET, person.photoPath);

  // QR con enlace absoluto a la ficha de la persona.
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const cardUrl = `${proto}://${host}/${locale}/personas/${person.id}`;
  const qrSvg =
    person.memberNumber !== null
      ? await QRCode.toString(cardUrl, { type: "svg", margin: 0, width: 132 })
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/personas/${person.id}`} />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToPersona")}
        </Button>
        {person.memberNumber !== null ? <PrintButton label={t("printAction")} /> : null}
      </div>

      {person.memberNumber === null ? (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {person.isMember ? t("memberCardNoNumber") : t("memberCardNotMember")}
          </p>
          {person.isMember ? <AssignMemberNumberButton personId={person.id} /> : null}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-sm">
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
                {person.memberNumber}
              </p>
            </div>
            {qrSvg ? (
              <div
                className="size-[72px] shrink-0"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
