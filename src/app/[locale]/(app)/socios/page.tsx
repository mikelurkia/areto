import { InboxIcon, UsersIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { registrations } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("socios.view");
  const canManage = hasPermission(user, "personas.manage");
  const t = await getTranslations("Socios");
  const tInscripciones = await getTranslations("Inscripciones");

  const [allPersons, memberRegistrations] = await Promise.all([
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true, email: true, phone: true },
      with: { clubMember: { columns: { status: true, memberNumber: true, joinedAt: true } } },
    }),
    db.query.registrations.findMany({
      where: eq(registrations.kind, "member"),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    }),
  ]);

  const socios = allPersons
    .filter((p) => p.clubMember?.status === "active")
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      memberNumber: p.clubMember?.memberNumber ?? null,
      joinedAt: p.clubMember?.joinedAt ?? "",
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const requestRows = memberRegistrations.map((r) => ({
    id: r.id,
    status: r.status,
    firstName: r.firstName,
    lastName: r.lastName,
    nationalId: r.nationalId,
    email: r.email,
    phone: r.phone,
    createdAt: r.createdAt.toISOString().slice(0, 10),
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
          <TabsTrigger value="socios">{t("tabSocios", { count: socios.length })}</TabsTrigger>
          <TabsTrigger value="solicitudes">
            {t("tabSolicitudes", { count: pendingCount })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="socios" keepMounted className="flex flex-col gap-3">
          {socios.length === 0 ? (
            <SectionPlaceholder
              icon={UsersIcon}
              title={t("emptySociosTitle")}
              description={t("emptySociosDescription")}
            />
          ) : (
            <SociosBrowser socios={socios} canManage={canManage} />
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
            <MemberRequestsBrowser registrations={requestRows} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

