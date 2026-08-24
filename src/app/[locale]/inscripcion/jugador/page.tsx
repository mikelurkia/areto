import { LockIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getRegistrationAvailability } from "@/lib/registration-settings";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "@/components/public/public-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { JugadorForm } from "./jugador-form";

// El envío sube hasta 3 ficheros (foto + DNI ambas caras, hasta 5MB c/u) a
// Supabase Storage desde la Server Action de esta página: con el timeout por
// defecto de Vercel (10s en Hobby) una conexión móvil lenta puede no dar
// tiempo a terminar. 60s es el máximo permitido en el plan Hobby.
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("playerCardTitle") };
}

export default async function InscripcionJugadorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const [t, { teamRegistrationOpen, seasonName }] = await Promise.all([
    getTranslations("Inscripciones"),
    getRegistrationAvailability(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader variant="back" maxWidth="2xl" backHref="/inscripcion" backLabel={t("backToLanding")} />

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {teamRegistrationOpen ? (
          <>
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{t("playerCardTitle")}</h1>
                {seasonName ? <Badge variant="secondary">{t("seasonBadge", { season: seasonName })}</Badge> : null}
              </div>
              <p className="text-muted-foreground">{t("playerFormSubtitle")}</p>
            </div>
            <JugadorForm />
          </>
        ) : (
          <SectionPlaceholder
            icon={LockIcon}
            title={t("registrationClosedTitle")}
            description={t("registrationClosedDescription")}
          />
        )}
      </div>
    </div>
  );
}
