import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";

/** Página pública de texto legal (SEPA, imagen, privacidad, condiciones...),
 * enlazada desde el formulario de inscripción con un "leer texto completo". */
export async function LegalInfoPage({
  title,
  body,
  backHref = "/inscripcion/jugador",
}: {
  title: string;
  body: string;
  backHref?: string;
}) {
  const t = await getTranslations("Inscripciones");
  const paragraphs = body.split("\n\n");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {t("backToLanding")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-col gap-4">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
