import { UsersIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { hasPermission, requirePermission } from "@/lib/auth";
import {
  hasActiveFilters,
  loadCurrentTeamOptions,
  loadPersonPage,
  loadPersonTagOptions,
  parsePersonFilters,
} from "@/lib/person-list";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { getSignedUrls } from "@/lib/supabase/storage";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { PersonasBrowser } from "@/components/personas/personas-browser";
import { PersonDialog } from "@/components/personas/person-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Button } from "@/components/ui/button";

const PHOTO_BUCKET = "person-photos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("personas") };
}

/**
 * Restringido a admin/staff: la ficha de persona incluye DNI, IBAN, dirección
 * y datos médicos de todo el club, no solo de quien consulta.
 */
export default async function PersonasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("personas.view");
  const t = await getTranslations("Personas");
  const canManage = hasPermission(user, "personas.manage");
  const canManageBanking = hasPermission(user, "personas.banking.manage");

  // Los filtros viven en la URL y se resuelven en SQL: de la tabla `persons`
  // solo suben las 25 filas de la página. El diálogo de alta ya no recibe la
  // lista de personas del club para elegir tutor; la busca al escribir.
  const filters = parsePersonFilters(await searchParams);
  const [personPage, teamOptions, tagOptions] = await Promise.all([
    loadPersonPage(filters),
    loadCurrentTeamOptions(),
    loadPersonTagOptions(),
  ]);

  // La miniatura, igual que en la plantilla de equipo: `getSignedUrls` solo
  // arma rutas del proxy autenticado, así que las 25 de la página no cuestan
  // ninguna llamada a Storage.
  const photoUrls = await getSignedUrls(
    PHOTO_BUCKET,
    personPage.rows,
    (p) => (p.photoPath ? personPhotoThumbPath(p.photoPath) : null),
    (p) => p.id,
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage ? (
            <>
              <Button
                variant="outline"
                render={<Link href="/personas/duplicados" />}
                nativeButton={false}
              >
                {t("reviewDuplicatesAction")}
              </Button>
              <PersonDialog mode="create" canManageBanking={canManageBanking} />
            </>
          ) : null
        }
      />

      {/* El vacío real (club sin personas) se distingue de "ningún resultado":
          sin filtros aplicados y sin filas, no hay nada que buscar todavía. */}
      {personPage.total === 0 && !hasActiveFilters(filters) ? (
        <SectionPlaceholder
          icon={UsersIcon}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <PersonasBrowser
          persons={personPage.rows}
          photoUrls={Object.fromEntries(photoUrls)}
          total={personPage.total}
          pageCount={personPage.pageCount}
          page={personPage.page}
          teamOptions={teamOptions}
          tagOptions={tagOptions}
          canManage={canManage}
          canManageBanking={canManageBanking}
        />
      )}
    </div>
  );
}
