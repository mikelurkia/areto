import { InboxIcon, UsersIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { registrations } from "@/db/schema";
import { hasAnyPermission, hasPermission, requirePermission } from "@/lib/auth";
import { hasActiveMemberFilters, loadMemberPage, parseMemberFilters } from "@/lib/member-list";
import { findCandidates } from "@/lib/person-matching";
import { MemberRequestsBrowser } from "@/components/socios/member-requests-browser";
import { SociosBrowser } from "@/components/socios/socios-browser";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("socios") };
}

export default async function SociosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("socios.view");
  const canManage = hasPermission(user, "personas.manage");
  // Borrar una solicitud de socio pide el mismo permiso que revisarla, que no
  // es el de gestionar personas del listado de socios.
  const canManageRequests = hasAnyPermission(user, ["inscripciones.manage", "socios.manage"]);
  const t = await getTranslations("Socios");
  const tInscripciones = await getTranslations("Inscripciones");

  // La pestaña "Socios" se filtra y pagina en la base de datos (mismo patrón
  // que /personas): de la tabla `persons` solo suben las filas de la página.
  // La pestaña "Solicitudes" sigue necesitando el club entero con columnas
  // mínimas, porque `findCandidates` compara cada solicitud contra todas las
  // personas para detectar duplicados antes de ofrecer la aprobación rápida.
  const filters = parseMemberFilters(await searchParams);
  const [memberPage, allPersons, memberRegistrations] = await Promise.all([
    loadMemberPage(filters),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true, email: true, nationalId: true },
    }),
    db.query.registrations.findMany({
      where: eq(registrations.kind, "member"),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: { guardians: true },
    }),
  ]);

  // "Aprobar" en la propia tabla solo es seguro cuando no hay ningún
  // candidato a duplicado (ni de la persona ni de sus tutores, si los
  // tiene) — si lo hay, hace falta abrir la ficha para revisarlo y decidir.
  const requestRows = memberRegistrations.map((r) => ({
    id: r.id,
    status: r.status,
    firstName: r.firstName,
    lastName: r.lastName,
    nationalId: r.nationalId,
    email: r.email,
    phone: r.phone,
    createdAt: r.createdAt.toISOString().slice(0, 10),
    canQuickApprove:
      findCandidates(r, allPersons).length === 0 &&
      r.guardians.every((g) => findCandidates(g, allPersons).length === 0),
  }));
  const pendingCount = requestRows.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="socios">
        <TabsList>
          <TabsTrigger value="socios">{t("tabSocios", { count: memberPage.total })}</TabsTrigger>
          <TabsTrigger value="solicitudes">
            {t("tabSolicitudes", { count: pendingCount })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="socios" keepMounted className="flex flex-col gap-3">
          {memberPage.total === 0 && !hasActiveMemberFilters(filters) ? (
            <SectionPlaceholder
              icon={UsersIcon}
              title={t("emptySociosTitle")}
              description={t("emptySociosDescription")}
            />
          ) : (
            <SociosBrowser
              socios={memberPage.rows}
              total={memberPage.total}
              pageCount={memberPage.pageCount}
              page={memberPage.page}
              canManage={canManage}
            />
          )}
        </TabsContent>

        <TabsContent value="solicitudes" keepMounted className="flex flex-col gap-3">
          {requestRows.length === 0 ? (
            <SectionPlaceholder
              icon={InboxIcon}
              title={tInscripciones("emptyTitle")}
              description={t("emptySolicitudesDescription")}
            />
          ) : (
            <MemberRequestsBrowser registrations={requestRows} canManage={canManageRequests} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

