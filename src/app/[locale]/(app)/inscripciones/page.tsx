import { ClipboardCheckIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { registrations } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { RegistrationsBrowser } from "@/components/inscripciones/registrations-browser";
import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("inscripciones") };
}

export default async function InscripcionesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Inscripciones");

  // Esta lista es solo de inscripciones de equipo (jugador/entrenador/staff);
  // las de socio viven en /socios, con su propia validación.
  const all = await db.query.registrations.findMany({
    where: eq(registrations.kind, "player"),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
    with: { guardians: { columns: { id: true } } },
  });

  const rows = all.map((r) => ({
    id: r.id,
    status: r.status,
    firstName: r.firstName,
    lastName: r.lastName,
    nationalId: r.nationalId,
    email: r.email,
    phone: r.phone,
    guardiansCount: r.guardians.length,
    photosCount: [r.photoPath, r.idFrontPath, r.idBackPath].filter(Boolean).length,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={ClipboardCheckIcon}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <RegistrationsBrowser registrations={rows} />
      )}
    </div>
  );
}
