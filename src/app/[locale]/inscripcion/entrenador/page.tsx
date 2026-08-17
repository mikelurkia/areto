import { ArrowLeftIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { EntrenadorForm } from "./entrenador-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("coachCardTitle") };
}

export default async function InscripcionEntrenadorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const t = await getTranslations("Inscripciones");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6">
          <Link
            href="/inscripcion"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {t("backToLanding")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t("coachCardTitle")}</h1>
          <p className="text-muted-foreground">{t("coachFormSubtitle")}</p>
        </div>
        <EntrenadorForm />
      </div>
    </div>
  );
}
